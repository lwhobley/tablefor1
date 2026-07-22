-- ============================================================
-- PHASE 18: Payment, invite, and feedback hardening
-- ============================================================


-- ---------- feedback: only match members with confirmed attendance can submit ----------
DROP POLICY IF EXISTS "feedback: insert own" ON public.feedback;

CREATE POLICY "feedback: insert own"
  ON public.feedback FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.events e ON e.id = m.event_id
      JOIN public.bookings b
        ON b.event_id = e.id
       AND b.user_id = auth.uid()
       AND b.status = 'confirmed'
      WHERE m.id = feedback.match_id
        AND auth.uid() = ANY(m.user_ids)
        AND e.event_date < now()
    )
  );


-- ---------- plus-one invites: bind booking invite IDs to event + invitee ----------
CREATE OR REPLACE FUNCTION public.validate_booking_plus_one_invite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite public.plus_one_invites;
BEGIN
  IF new.plus_one_invite_id IS NULL THEN
    RETURN new;
  END IF;

  IF new.status NOT IN ('pending', 'confirmed') THEN
    RETURN new;
  END IF;

  SELECT * INTO v_invite
  FROM public.plus_one_invites
  WHERE id = new.plus_one_invite_id;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invalid plus-one invite.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_invite.event_id <> new.event_id THEN
    RAISE EXCEPTION 'Plus-one invite is for a different event.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_invite.invitee_id IS DISTINCT FROM new.user_id THEN
    RAISE EXCEPTION 'Plus-one invite is not claimed by this user.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_invite.used_at IS NOT NULL AND new.status = 'pending' THEN
    RAISE EXCEPTION 'Plus-one invite has already been used.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_booking_plus_one_invite ON public.bookings;

CREATE TRIGGER trg_validate_booking_plus_one_invite
  BEFORE INSERT OR UPDATE OF plus_one_invite_id, event_id, user_id, status
  ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_booking_plus_one_invite();
