-- ============================================================
-- PHASE 7: Bring a +1 Token Integration
-- ============================================================

-- ---------- users: add plus_one_tokens count ----------
ALTER TABLE public.users
ADD COLUMN plus_one_tokens int not null default 0;

-- ---------- plus_one_invites table ----------
CREATE TABLE public.plus_one_invites (
  id            uuid primary key default uuid_generate_v4(),
  sender_id     uuid not null references public.users(id) on delete cascade,
  event_id      uuid not null references public.events(id) on delete cascade,
  invite_code   text not null unique,
  invitee_id    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  used_at       timestamptz,
  unique (sender_id, event_id) -- one invite per sender per event
);

ALTER TABLE public.plus_one_invites enable row level security;

-- RLS Policies for plus_one_invites
CREATE POLICY "invites: read own sent"
  ON public.plus_one_invites FOR SELECT
  USING (auth.uid() = sender_id);

CREATE POLICY "invites: read own received"
  ON public.plus_one_invites FOR SELECT
  USING (auth.uid() = invitee_id);

-- Anyone authenticated can select/read details of an invite if they have the code (to claim it)
CREATE POLICY "invites: read by code"
  ON public.plus_one_invites FOR SELECT
  USING (auth.role() = 'authenticated');

-- ---------- bookings: link to plus_one_invite ----------
ALTER TABLE public.bookings
ADD COLUMN plus_one_invite_id uuid references public.plus_one_invites(id) on delete set null;

-- ---------- function: recalculate_plus_one_tokens ----------
CREATE OR REPLACE FUNCTION public.recalculate_plus_one_tokens(p_user_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_completed_count int;
  v_tokens_used int;
  v_tokens_total int;
  v_net_tokens int;
BEGIN
  -- Count completed dinners where they checked in
  SELECT count(*) INTO v_completed_count
  FROM public.bookings b
  JOIN public.events e ON e.id = b.event_id
  WHERE b.user_id = p_user_id
    AND b.status = 'confirmed'
    AND e.status = 'completed'
    AND EXISTS (SELECT 1 FROM public.checkins c WHERE c.booking_id = b.id);

  -- Count total invites sent (which consume tokens)
  SELECT count(*) INTO v_tokens_used
  FROM public.plus_one_invites
  WHERE sender_id = p_user_id;

  -- 1 token earned for every 5 completed dinners
  v_tokens_total := floor(v_completed_count / 5);
  v_net_tokens := greatest(0, v_tokens_total - v_tokens_used);

  UPDATE public.users
  SET plus_one_tokens = v_net_tokens
  WHERE id = p_user_id;

  RETURN v_net_tokens;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_plus_one_tokens(uuid) TO authenticated;

-- ---------- function: create_plus_one_invite ----------
-- Validates, generates code, and inserts invite row.
CREATE OR REPLACE FUNCTION public.create_plus_one_invite(p_event_id uuid)
RETURNS public.plus_one_invites
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tokens int;
  v_invite_code text;
  v_invite public.plus_one_invites;
BEGIN
  -- 1. Ensure user has a confirmed booking for the event
  IF NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE event_id = p_event_id AND user_id = auth.uid() AND status = 'confirmed'
  ) THEN
    RAISE EXCEPTION 'You must have a confirmed booking to invite a friend.';
  END IF;

  -- 2. Recalculate tokens to make sure counts are fresh
  PERFORM public.recalculate_plus_one_tokens(auth.uid());

  -- 3. Check token count
  SELECT plus_one_tokens INTO v_tokens FROM public.users WHERE id = auth.uid();
  IF v_tokens <= 0 THEN
    RAISE EXCEPTION 'You do not have any +1 tokens left.';
  END IF;

  -- 4. Check if invite already exists for this sender/event
  SELECT * INTO v_invite 
  FROM public.plus_one_invites 
  WHERE sender_id = auth.uid() AND event_id = p_event_id;
  
  IF v_invite.id IS NOT NULL THEN
    RETURN v_invite;
  END IF;

  -- 5. Generate a unique invite code (6 characters alphanumeric uppercase)
  LOOP
    v_invite_code := upper(substring(md5(random()::text) from 1 for 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.plus_one_invites WHERE invite_code = v_invite_code);
  END LOOP;

  -- 6. Create the invite
  INSERT INTO public.plus_one_invites (sender_id, event_id, invite_code)
  VALUES (auth.uid(), p_event_id, v_invite_code)
  RETURNING * INTO v_invite;

  -- 7. Recalculate tokens to update balance
  PERFORM public.recalculate_plus_one_tokens(auth.uid());

  RETURN v_invite;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_plus_one_invite(uuid) TO authenticated;

-- ---------- function: claim_plus_one_invite ----------
-- Links a user's ID to a pending invite code.
CREATE OR REPLACE FUNCTION public.claim_plus_one_invite(p_invite_code text)
RETURNS public.plus_one_invites
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invite public.plus_one_invites;
BEGIN
  -- Find invite
  SELECT * INTO v_invite
  FROM public.plus_one_invites
  WHERE invite_code = upper(trim(p_invite_code))
    AND invitee_id IS NULL;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or already claimed invite code.';
  END IF;

  IF v_invite.sender_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot claim your own invite.';
  END IF;

  -- Claim the invite
  UPDATE public.plus_one_invites
  SET invitee_id = auth.uid()
  WHERE id = v_invite.id
  RETURNING * INTO v_invite;

  RETURN v_invite;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_plus_one_invite(text) TO authenticated;

-- ---------- trigger: handle_booking_confirmed_invite ----------
-- Marks invite as used and recalculates sender's tokens when booking is confirmed.
CREATE OR REPLACE FUNCTION public.handle_booking_confirmed_invite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sender_id uuid;
BEGIN
  IF new.status = 'confirmed' AND old.status = 'pending' AND new.plus_one_invite_id IS NOT NULL THEN
    UPDATE public.plus_one_invites
    SET used_at = now()
    WHERE id = new.plus_one_invite_id
    RETURNING sender_id INTO v_sender_id;

    IF v_sender_id IS NOT NULL THEN
      PERFORM public.recalculate_plus_one_tokens(v_sender_id);
    END IF;
  END IF;
  RETURN new;
END;
$$;

CREATE TRIGGER trg_booking_confirmed_invite
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_booking_confirmed_invite();

-- ---------- trigger: handle_booking_cancelled_invite ----------
-- Frees up the invite and refunds token if a booking is cancelled.
CREATE OR REPLACE FUNCTION public.handle_booking_cancelled_invite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sender_id uuid;
BEGIN
  IF new.status = 'cancelled' AND old.status = 'confirmed' AND new.plus_one_invite_id IS NOT NULL THEN
    UPDATE public.plus_one_invites
    SET used_at = null,
        invitee_id = null
    WHERE id = new.plus_one_invite_id
    RETURNING sender_id INTO v_sender_id;

    IF v_sender_id IS NOT NULL THEN
      PERFORM public.recalculate_plus_one_tokens(v_sender_id);
    END IF;
  END IF;
  RETURN new;
END;
$$;

CREATE TRIGGER trg_booking_cancelled_invite
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_booking_cancelled_invite();
