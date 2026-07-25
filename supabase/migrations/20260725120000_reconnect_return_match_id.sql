-- The create_reconnect_dinner_atomic RPC inserts a match row but never
-- captures its id, so the client cannot navigate to the match detail screen.
CREATE OR REPLACE FUNCTION public.create_reconnect_dinner_atomic(
  p_reconnect_request_id uuid,
  p_restaurant_id uuid,
  p_event_date timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_request public.reconnect_requests%ROWTYPE;
  v_restaurant public.restaurants%ROWTYPE;
  v_city text;
  v_event_id uuid;
  v_match_id uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_event_date IS NULL
     OR p_event_date <= now()
     OR p_event_date > now() + interval '90 days' THEN
    RAISE EXCEPTION 'Event date must be in the next 90 days'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_request
  FROM public.reconnect_requests
  WHERE id = p_reconnect_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reconnect request not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_caller_id NOT IN (v_request.user_id, v_request.target_user_id) THEN
    RAISE EXCEPTION 'Not authorized to schedule this reconnect dinner'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_request.status <> 'accepted' THEN
    RAISE EXCEPTION 'Reconnect request must be accepted first'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_request.event_id IS NOT NULL THEN
    RAISE EXCEPTION 'Reconnect dinner has already been scheduled'
      USING ERRCODE = 'unique_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sparks outgoing
    JOIN public.sparks incoming
      ON incoming.match_id = outgoing.match_id
     AND incoming.user_id = outgoing.target_user_id
     AND incoming.target_user_id = outgoing.user_id
     AND incoming.sparked
    WHERE outgoing.user_id = v_request.user_id
      AND outgoing.target_user_id = v_request.target_user_id
      AND outgoing.sparked
  ) THEN
    RAISE EXCEPTION 'Users do not have a mutual spark'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT city INTO v_city
  FROM public.users
  WHERE id = v_request.user_id;

  SELECT * INTO v_restaurant
  FROM public.restaurants
  WHERE id = p_restaurant_id;

  IF NOT FOUND OR NOT v_restaurant.is_active OR v_restaurant.city <> v_city THEN
    RAISE EXCEPTION 'Restaurant is not available for this reconnect dinner'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.events (
    restaurant_id, event_date, group_size, status, city, format,
    price_cents, is_mystery
  ) VALUES (
    p_restaurant_id, p_event_date, 2, 'matched', v_city, 'dinner', 0, false
  ) RETURNING id INTO v_event_id;

  INSERT INTO public.bookings (event_id, user_id, status, amount_cents)
  VALUES
    (v_event_id, v_request.user_id, 'confirmed', 0),
    (v_event_id, v_request.target_user_id, 'confirmed', 0);

  INSERT INTO public.matches (event_id, user_ids, score, revealed_at)
  VALUES (
    v_event_id,
    ARRAY[v_request.user_id, v_request.target_user_id],
    100.00,
    now()
  ) RETURNING id INTO v_match_id;

  UPDATE public.reconnect_requests
  SET event_id = v_event_id
  WHERE id = v_request.id;

  RETURN jsonb_build_object('success', true, 'event_id', v_event_id, 'match_id', v_match_id);
END;
$$;
