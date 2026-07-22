-- ============================================================
-- Review hardening round 2: booking/payment, reconnect, roulette,
-- private chat media, and scoped helper functions.
-- ============================================================

-- ---------- bookings: clients may only create pending checkout rows ----------
DROP POLICY IF EXISTS "bookings: insert own" ON public.bookings;

CREATE POLICY "bookings: insert own"
  ON public.bookings FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND stripe_session_id IS NULL
    AND stripe_payment_id IS NULL
    AND amount_cents >= 0
  );

-- The previous capacity trigger only ran on UPDATE. Confirmed bookings can be
-- inserted by trusted server workflows too, so enforce capacity on INSERT and
-- UPDATE while still allowing pending checkout rows to be created.
CREATE OR REPLACE FUNCTION public.enforce_booking_capacity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_group_size int;
  v_confirmed int;
BEGIN
  IF new.status = 'confirmed'
     AND (TG_OP = 'INSERT' OR old.status IS DISTINCT FROM 'confirmed') THEN
    SELECT group_size INTO v_group_size
    FROM public.events
    WHERE id = new.event_id
    FOR UPDATE;

    SELECT count(*) INTO v_confirmed
    FROM public.bookings
    WHERE event_id = new.event_id
      AND status = 'confirmed'
      AND id <> new.id;

    IF v_confirmed >= v_group_size THEN
      RAISE EXCEPTION 'Event % is already at capacity (% / %)', new.event_id, v_confirmed, v_group_size
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_booking_capacity ON public.bookings;

CREATE TRIGGER trg_enforce_booking_capacity
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_capacity();

-- Reconnect dinners are comped system-created events, so allow zero-price rows
-- while still rejecting negative prices.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_price_cents_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_price_cents_check CHECK (price_cents >= 0);


-- ---------- reconnect: only recipients can accept/decline pending requests ----------
DROP POLICY IF EXISTS "reconnect_requests: update involved" ON public.reconnect_requests;

CREATE POLICY "reconnect_requests: recipient responds"
  ON public.reconnect_requests FOR UPDATE
  USING (
    auth.uid() = target_user_id
    AND status = 'pending'
    AND event_id IS NULL
  )
  WITH CHECK (
    auth.uid() = target_user_id
    AND status IN ('accepted', 'declined')
    AND event_id IS NULL
  );

REVOKE UPDATE ON public.reconnect_requests FROM authenticated;
GRANT UPDATE (status) ON public.reconnect_requests TO authenticated;


-- ---------- roulette: opt-in only for eligible diners in their own city ----------
DROP POLICY IF EXISTS "roulette_opt_ins: insert own" ON public.roulette_opt_ins;

CREATE POLICY "roulette_opt_ins: insert own eligible"
  ON public.roulette_opt_ins FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND date >= current_date
    AND date <= current_date + 14
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.city = roulette_opt_ins.city
        AND u.is_active = true
        AND u.trust_score >= 70
        AND public.is_premium_active(u.is_premium, u.premium_expires_at)
    )
  );


-- ---------- spark helper: do not expose pair-level spark state to third parties ----------
CREATE OR REPLACE FUNCTION public.has_mutual_spark(p_user_a uuid, p_user_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IN (p_user_a, p_user_b)
    AND EXISTS (
      SELECT 1 FROM public.sparks s1
      JOIN public.sparks s2 ON s1.match_id = s2.match_id
      WHERE s1.user_id = p_user_a AND s1.target_user_id = p_user_b AND s1.sparked = true
        AND s2.user_id = p_user_b AND s2.target_user_id = p_user_a AND s2.sparked = true
    );
$$;

REVOKE EXECUTE ON FUNCTION public.has_mutual_spark(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_mutual_spark(uuid, uuid) TO authenticated;


-- ---------- reactions: mirror private message visibility ----------
DROP POLICY IF EXISTS "message_reactions: select visible" ON public.message_reactions;
DROP POLICY IF EXISTS "message_reactions: insert own" ON public.message_reactions;

CREATE POLICY "message_reactions: select visible"
  ON public.message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages msg
      JOIN public.matches m ON m.id = msg.match_id
      WHERE msg.id = message_reactions.message_id
        AND auth.uid() = ANY(m.user_ids)
        AND (
          msg.recipient_id IS NULL
          OR auth.uid() IN (msg.sender_id, msg.recipient_id)
        )
    )
  );

CREATE POLICY "message_reactions: insert own"
  ON public.message_reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.messages msg
      JOIN public.matches m ON m.id = msg.match_id
      WHERE msg.id = message_reactions.message_id
        AND auth.uid() = ANY(m.user_ids)
        AND (
          msg.recipient_id IS NULL
          OR auth.uid() IN (msg.sender_id, msg.recipient_id)
        )
    )
  );


-- ---------- chat photos: private bucket, signed URLs for visible messages ----------
UPDATE public.messages
SET photo_url = substring(photo_url from '/chat-photos/([^?]+)')
WHERE photo_url LIKE '%/chat-photos/%';

UPDATE storage.buckets
SET public = false
WHERE id = 'chat-photos';

DROP POLICY IF EXISTS "chat-photos: public read" ON storage.objects;
DROP POLICY IF EXISTS "chat-photos: visible message read" ON storage.objects;

CREATE POLICY "chat-photos: visible message read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'chat-photos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1
        FROM public.messages msg
        JOIN public.matches m ON m.id = msg.match_id
        WHERE msg.photo_url = storage.objects.name
          AND auth.uid() = ANY(m.user_ids)
          AND (
            msg.recipient_id IS NULL
            OR auth.uid() IN (msg.sender_id, msg.recipient_id)
          )
      )
    )
  );
