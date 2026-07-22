-- ============================================================
-- PHASE 17: Close remaining post-review security/consistency gaps
-- ============================================================


-- ---------- users: prevent self-escalation of server-controlled fields ----------
-- RLS policies restrict which rows can be updated, not which columns in those
-- rows. Limit authenticated clients to profile-edit fields; premium, Stripe,
-- trust, streak, token, and perk columns stay controlled by RPCs/webhooks.
DROP POLICY IF EXISTS "users: update own row" ON public.users;

CREATE POLICY "users: update own row"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

REVOKE UPDATE ON public.users FROM authenticated;
GRANT UPDATE (
  name,
  photo_url,
  bio,
  city,
  neighborhood,
  energy_level,
  conv_style,
  food_prefs,
  dietary,
  languages,
  is_active,
  updated_at
) ON public.users TO authenticated;


-- ---------- trust/streak: use the same attendance signal ----------
-- A completed confirmed booking counts as attended only with a check-in or
-- explicit positive feedback. A negative feedback row counts as a miss.
CREATE OR REPLACE FUNCTION public.recalculate_trust_score()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_total_past int;
  v_attended int;
  v_score int;
BEGIN
  SELECT count(*) INTO v_total_past
  FROM public.bookings b
  JOIN public.events e ON e.id = b.event_id
  WHERE b.user_id = v_user_id
    AND b.status = 'confirmed'
    AND e.status = 'completed'
    AND e.event_date < now();

  SELECT count(*) INTO v_attended
  FROM public.bookings b
  JOIN public.events e ON e.id = b.event_id
  WHERE b.user_id = v_user_id
    AND b.status = 'confirmed'
    AND e.status = 'completed'
    AND e.event_date < now()
    AND (
      EXISTS (SELECT 1 FROM public.checkins c WHERE c.booking_id = b.id)
      OR EXISTS (
        SELECT 1
        FROM public.matches m
        JOIN public.feedback f ON f.match_id = m.id
        WHERE m.event_id = e.id
          AND v_user_id = ANY(m.user_ids)
          AND f.reviewer_id = v_user_id
          AND f.showed_up = true
      )
    );

  IF v_total_past = 0 THEN
    v_score := 100;
  ELSE
    v_score := round(100.0 * v_attended / v_total_past);
  END IF;

  UPDATE public.users
  SET trust_score = v_score,
      no_show_count = greatest(v_total_past - v_attended, 0)
  WHERE id = v_user_id;

  RETURN v_score;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_streak()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_streak int := 0;
  v_row record;
BEGIN
  FOR v_row IN
    SELECT
      b.id AS booking_id,
      e.event_date,
      (
        EXISTS (SELECT 1 FROM public.checkins c WHERE c.booking_id = b.id)
        OR EXISTS (
          SELECT 1
          FROM public.matches m
          JOIN public.feedback f ON f.match_id = m.id
          WHERE m.event_id = e.id
            AND v_user_id = ANY(m.user_ids)
            AND f.reviewer_id = v_user_id
            AND f.showed_up = true
        )
      ) AS attended
    FROM public.bookings b
    JOIN public.events e ON e.id = b.event_id
    WHERE b.user_id = v_user_id
      AND b.status = 'confirmed'
      AND e.status = 'completed'
      AND e.event_date < now()
    ORDER BY e.event_date DESC
  LOOP
    IF v_row.attended THEN
      v_streak := v_streak + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  UPDATE public.users
  SET streak_count = v_streak, streak_updated_at = now()
  WHERE id = v_user_id;

  RETURN v_streak;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recalculate_trust_score() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.recalculate_streak() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.recalculate_trust_score() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_streak() TO authenticated;


-- ---------- is_mutual_spark: scope helper to the caller and lock grants ----------
CREATE OR REPLACE FUNCTION public.is_mutual_spark(p_match_id uuid, p_user_a uuid, p_user_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IN (p_user_a, p_user_b)
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = p_match_id
        AND p_user_a = ANY(m.user_ids)
        AND p_user_b = ANY(m.user_ids)
    )
    AND EXISTS (
      SELECT 1 FROM public.sparks
      WHERE match_id = p_match_id
        AND user_id = p_user_a
        AND target_user_id = p_user_b
        AND sparked = true
    )
    AND EXISTS (
      SELECT 1 FROM public.sparks
      WHERE match_id = p_match_id
        AND user_id = p_user_b
        AND target_user_id = p_user_a
        AND sparked = true
    );
$$;

REVOKE EXECUTE ON FUNCTION public.is_mutual_spark(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_mutual_spark(uuid, uuid, uuid) TO authenticated;


-- ---------- messages: model private mutual-spark conversations ----------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_messages_private_pair
  ON public.messages(match_id, sender_id, recipient_id, created_at)
  WHERE recipient_id IS NOT NULL;

DROP POLICY IF EXISTS "messages: read if in match" ON public.messages;
DROP POLICY IF EXISTS "messages: insert when revealed" ON public.messages;
DROP POLICY IF EXISTS "messages: insert if reconnected" ON public.messages;
DROP POLICY IF EXISTS "messages: insert if mutual spark" ON public.messages;

CREATE POLICY "messages: read if visible"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = messages.match_id
        AND auth.uid() = ANY(m.user_ids)
        AND (
          messages.recipient_id IS NULL
          OR auth.uid() IN (messages.sender_id, messages.recipient_id)
        )
    )
  );

CREATE POLICY "messages: insert when revealed"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND recipient_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.events e ON e.id = m.event_id
      WHERE m.id = messages.match_id
        AND auth.uid() = ANY(m.user_ids)
        AND m.revealed_at IS NOT NULL
        AND e.event_date > now()
    )
  );

CREATE POLICY "messages: insert if reconnected"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND recipient_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = messages.match_id
        AND auth.uid() = ANY(m.user_ids)
    )
    AND EXISTS (
      SELECT 1 FROM public.feedback f
      WHERE f.match_id = messages.match_id
        AND f.reviewer_id = auth.uid()
        AND f.reconnect = true
    )
  );

CREATE POLICY "messages: insert if mutual spark"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND recipient_id IS NOT NULL
    AND sender_id <> recipient_id
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = messages.match_id
        AND sender_id = ANY(m.user_ids)
        AND recipient_id = ANY(m.user_ids)
    )
    AND public.is_mutual_spark(messages.match_id, sender_id, recipient_id)
  );


-- ---------- profile exposure: use safe profile payloads for fellow diners ----------
DROP POLICY IF EXISTS "users: read fellow event attendees" ON public.users;

CREATE OR REPLACE FUNCTION public.safe_profile_json(u public.users)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', u.id,
    'name', u.name,
    'photo_url', u.photo_url,
    'bio', u.bio,
    'city', u.city,
    'neighborhood', u.neighborhood,
    'energy_level', u.energy_level,
    'conv_style', u.conv_style,
    'food_prefs', u.food_prefs,
    'dietary', u.dietary,
    'languages', u.languages,
    'is_active', u.is_active,
    'created_at', u.created_at,
    'updated_at', u.updated_at
  );
$$;

REVOKE EXECUTE ON FUNCTION public.safe_profile_json(public.users) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_event_attendees(p_event_id uuid)
RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.safe_profile_json(u)
  FROM public.bookings mine
  JOIN public.bookings other
    ON other.event_id = mine.event_id
   AND other.status = 'confirmed'
   AND other.user_id <> auth.uid()
  JOIN public.events e ON e.id = mine.event_id
  JOIN public.users u ON u.id = other.user_id
  WHERE mine.event_id = p_event_id
    AND mine.user_id = auth.uid()
    AND mine.status = 'confirmed'
    AND e.event_date >= now() - interval '24 hours'
  ORDER BY u.name;
$$;

REVOKE EXECUTE ON FUNCTION public.get_event_attendees(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_event_attendees(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_matches()
RETURNS TABLE (
  id uuid,
  event_id uuid,
  user_ids uuid[],
  score numeric,
  revealed_at timestamptz,
  created_at timestamptz,
  diners jsonb,
  event jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    m.id, m.event_id, m.user_ids, m.score, m.revealed_at, m.created_at,
    (SELECT jsonb_agg(public.safe_profile_json(u)) FROM public.users u WHERE u.id = ANY(m.user_ids)) AS diners,
    (
      SELECT jsonb_build_object(
        'id', e.id, 'restaurant_id', e.restaurant_id, 'format', e.format, 'status', e.status,
        'event_date', e.event_date, 'group_size', e.group_size, 'price_cents', e.price_cents,
        'city', e.city, 'description', e.description, 'is_mystery', e.is_mystery,
        'reveal_hours_before', e.reveal_hours_before,
        'restaurant', jsonb_build_object('name', r.name, 'neighborhood', r.neighborhood, 'cuisine', r.cuisine)
      )
      FROM public.events e JOIN public.restaurants r ON r.id = e.restaurant_id
      WHERE e.id = m.event_id
    ) AS event
  FROM public.matches m
  WHERE auth.uid() = ANY(m.user_ids)
  ORDER BY m.revealed_at DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.get_match_detail(p_match_id uuid)
RETURNS TABLE (
  id uuid,
  event_id uuid,
  user_ids uuid[],
  score numeric,
  revealed_at timestamptz,
  created_at timestamptz,
  diners jsonb,
  event jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    m.id, m.event_id, m.user_ids, m.score, m.revealed_at, m.created_at,
    (SELECT jsonb_agg(public.safe_profile_json(u)) FROM public.users u WHERE u.id = ANY(m.user_ids)) AS diners,
    (
      SELECT jsonb_build_object(
        'id', e.id, 'restaurant_id', e.restaurant_id, 'format', e.format, 'status', e.status,
        'event_date', e.event_date, 'group_size', e.group_size, 'price_cents', e.price_cents,
        'city', e.city, 'description', e.description, 'is_mystery', e.is_mystery,
        'reveal_hours_before', e.reveal_hours_before,
        'restaurant', jsonb_build_object('name', r.name, 'neighborhood', r.neighborhood, 'cuisine', r.cuisine)
      )
      FROM public.events e JOIN public.restaurants r ON r.id = e.restaurant_id
      WHERE e.id = m.event_id
    ) AS event
  FROM public.matches m
  WHERE m.id = p_match_id AND auth.uid() = ANY(m.user_ids);
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_matches() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_match_detail(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_matches() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_match_detail(uuid) TO authenticated;


-- ---------- waitlist: notify only as many diners as newly open seats ----------
CREATE OR REPLACE FUNCTION public.notify_waitlist_on_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_group_size int;
  v_confirmed int;
  v_open_seats int;
BEGIN
  IF new.status = 'cancelled' AND old.status = 'confirmed' THEN
    SELECT group_size INTO v_group_size FROM public.events WHERE id = new.event_id;
    SELECT count(*) INTO v_confirmed
    FROM public.bookings
    WHERE event_id = new.event_id AND status = 'confirmed';

    v_open_seats := greatest(v_group_size - v_confirmed, 0);

    IF v_open_seats > 0 THEN
      UPDATE public.event_waitlist ew
      SET notified_at = now()
      WHERE ew.id IN (
        SELECT id
        FROM public.event_waitlist
        WHERE event_id = new.event_id
          AND notified_at IS NULL
        ORDER BY created_at
        LIMIT v_open_seats
      );
    END IF;
  END IF;

  RETURN new;
END;
$$;
