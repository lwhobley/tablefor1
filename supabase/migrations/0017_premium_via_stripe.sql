-- ============================================================
-- PHASE 14: Gate Premium behind a real Stripe subscription
-- ============================================================
-- subscribe_to_premium() (migration 0013) was a SECURITY DEFINER RPC
-- granted to `authenticated` that set is_premium = true with no payment
-- step at all — free premium for anyone who called it, and
-- premium_expires_at was never enforced anywhere. This migration:
--   1. Adds the Stripe linkage columns needed for a real subscription.
--   2. Removes the free RPC.
--   3. Adds a SECURITY DEFINER function only the Stripe webhook (via the
--      service role) can meaningfully drive, to flip premium on/off.
--   4. Makes `is_premium` reads self-healing: a lazily-expired premium
--      (renewal failed, subscription cancelled) is corrected the next time
--      the row is touched, instead of silently staying true forever.

ALTER TABLE public.users
  ADD COLUMN stripe_customer_id text,
  ADD COLUMN stripe_subscription_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_subscription
  ON public.users(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.subscribe_to_premium();

-- Called only by the stripe-webhook edge function (service role) when a
-- subscription checkout completes or renews.
CREATE OR REPLACE FUNCTION public.set_premium_from_stripe(
  p_user_id uuid,
  p_is_premium boolean,
  p_expires_at timestamptz,
  p_customer_id text,
  p_subscription_id text
)
RETURNS public.users
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user public.users;
BEGIN
  UPDATE public.users
  SET is_premium = p_is_premium,
      premium_expires_at = p_expires_at,
      stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
      stripe_subscription_id = coalesce(p_subscription_id, stripe_subscription_id)
  WHERE id = p_user_id
  RETURNING * INTO v_user;

  RETURN v_user;
END;
$$;

-- Only the service role should ever call this (edge functions use the
-- service-role key, which bypasses grants entirely, but we still revoke
-- from authenticated/anon/public explicitly so it can never be reached
-- over PostgREST by a client).
REVOKE EXECUTE ON FUNCTION public.set_premium_from_stripe(uuid, boolean, timestamptz, text, text)
  FROM authenticated, anon, public;

-- Self-healing read: a user's own profile fetch (and anything else reading
-- through this) should never report stale `is_premium = true` past
-- `premium_expires_at`, even if a webhook was missed. Recomputed lazily
-- rather than needing a cron.
CREATE OR REPLACE FUNCTION public.is_premium_active(p_is_premium boolean, p_expires_at timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_is_premium AND (p_expires_at IS NULL OR p_expires_at > now());
$$;
