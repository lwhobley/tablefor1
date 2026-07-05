-- ============================================================
-- PHASE 10: Premium Tier (Subscriptions, Seating, Early Access)
-- ============================================================

-- ---------- users: subscription & preference additions ----------
ALTER TABLE public.users
ADD COLUMN is_premium BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN premium_expires_at TIMESTAMPTZ,
ADD COLUMN prefers_window_seat BOOLEAN NOT NULL DEFAULT false;

-- ---------- events: early access anchor additions ----------
ALTER TABLE public.events
ADD COLUMN published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
ADD COLUMN early_access_hours INT NOT NULL DEFAULT 24;

-- ---------- function: subscribe_to_premium ----------
CREATE OR REPLACE FUNCTION public.subscribe_to_premium()
RETURNS public.users
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user public.users;
BEGIN
  UPDATE public.users
  SET is_premium = true,
      premium_expires_at = now() + interval '30 days'
  WHERE id = auth.uid()
  RETURNING * INTO v_user;

  RETURN v_user;
END;
$$;

GRANT EXECUTE ON FUNCTION public.subscribe_to_premium() TO authenticated;

-- ---------- function: toggle_window_seat_preference ----------
CREATE OR REPLACE FUNCTION public.toggle_window_seat_preference()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_new_pref BOOLEAN;
BEGIN
  UPDATE public.users
  SET prefers_window_seat = NOT prefers_window_seat
  WHERE id = auth.uid()
  RETURNING prefers_window_seat INTO v_new_pref;

  RETURN v_new_pref;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_window_seat_preference() TO authenticated;
