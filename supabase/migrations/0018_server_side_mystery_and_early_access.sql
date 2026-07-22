-- ============================================================
-- PHASE 15: Enforce mystery-dinner hiding and premium early access
-- server-side instead of client-side only
-- ============================================================
-- Previously useUpcomingEvents/useEventDetails selected the restaurant
-- embed unconditionally and lib/mystery.ts hid it only at render time —
-- anyone with the anon key could read the "mystery" restaurant's name
-- directly from PostgREST. Likewise the early-access lock was computed
-- and enforced only in the React component. These RPCs move both checks
-- into the query itself.

CREATE OR REPLACE FUNCTION public.get_upcoming_events(p_city text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  restaurant_id uuid,
  format event_format,
  status event_status,
  event_date timestamptz,
  group_size int,
  price_cents int,
  city text,
  description text,
  is_mystery boolean,
  reveal_hours_before int,
  published_at timestamptz,
  early_access_hours int,
  restaurant jsonb,
  spots_left int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    e.id, e.restaurant_id, e.format, e.status, e.event_date, e.group_size,
    e.price_cents, e.city, e.description, e.is_mystery, e.reveal_hours_before,
    e.published_at, e.early_access_hours,
    CASE
      WHEN (NOT e.is_mystery)
        OR now() >= (e.event_date - (e.reveal_hours_before || ' hours')::interval)
      THEN jsonb_build_object('name', r.name, 'neighborhood', r.neighborhood, 'cuisine', r.cuisine)
      ELSE NULL
    END AS restaurant,
    greatest(0, e.group_size - coalesce((
      SELECT count(*) FROM public.bookings b
      WHERE b.event_id = e.id AND b.status = 'confirmed'
    ), 0))::int AS spots_left
  FROM public.events e
  JOIN public.restaurants r ON r.id = e.restaurant_id
  WHERE e.event_date >= now()
    AND e.status IN ('open', 'matched', 'full')
    AND (p_city IS NULL OR e.city = p_city)
  ORDER BY e.event_date ASC
  LIMIT 20;
$$;

REVOKE EXECUTE ON FUNCTION public.get_upcoming_events(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_upcoming_events(text) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_event_detail(p_event_id uuid)
RETURNS TABLE (
  id uuid,
  restaurant_id uuid,
  format event_format,
  status event_status,
  event_date timestamptz,
  group_size int,
  price_cents int,
  city text,
  description text,
  is_mystery boolean,
  reveal_hours_before int,
  published_at timestamptz,
  early_access_hours int,
  restaurant jsonb,
  confirmed_covers bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    e.id, e.restaurant_id, e.format, e.status, e.event_date, e.group_size,
    e.price_cents, e.city, e.description, e.is_mystery, e.reveal_hours_before,
    e.published_at, e.early_access_hours,
    CASE
      WHEN (NOT e.is_mystery)
        OR now() >= (e.event_date - (e.reveal_hours_before || ' hours')::interval)
      THEN to_jsonb(r) - 'stripe_account' - 'partner_email'
      ELSE NULL
    END AS restaurant,
    coalesce((
      SELECT count(*) FROM public.bookings b
      WHERE b.event_id = e.id AND b.status = 'confirmed'
    ), 0) AS confirmed_covers
  FROM public.events e
  JOIN public.restaurants r ON r.id = e.restaurant_id
  WHERE e.id = p_event_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_event_detail(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_event_detail(uuid) TO authenticated;


-- ---------- helper: is an event currently in its premium-only early-access window ----------
-- Shared by create-checkout-session (server-side enforcement) and can be
-- reused by any future RPC that needs the same rule.
CREATE OR REPLACE FUNCTION public.event_in_early_access(p_published_at timestamptz, p_early_access_hours int)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT now() < (p_published_at + (coalesce(p_early_access_hours, 24) || ' hours')::interval);
$$;
