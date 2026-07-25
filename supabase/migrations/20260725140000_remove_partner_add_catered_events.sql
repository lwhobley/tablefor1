-- Remove partner/payout infrastructure and add catered event support.
--
-- The app books Resy reservations directly rather than partnering with
-- restaurants.  A new "catered" event type covers privately catered
-- dinners, lunches, brunches, and picnics at venues chosen by the app.

-- ============================================================
-- 1. New event formats: lunch, picnic
-- ============================================================

ALTER TYPE event_format ADD VALUE IF NOT EXISTS 'lunch';
ALTER TYPE event_format ADD VALUE IF NOT EXISTS 'picnic';

-- ============================================================
-- 2. Event type: reservation (Resy) vs catered (private)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE event_type AS ENUM ('reservation', 'catered');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_type event_type NOT NULL DEFAULT 'reservation';

-- ============================================================
-- 3. Drop partner RPC functions
-- ============================================================

DROP FUNCTION IF EXISTS public.partner_my_restaurant();
DROP FUNCTION IF EXISTS public.partner_upcoming_events();
DROP FUNCTION IF EXISTS public.partner_dashboard_stats();
DROP FUNCTION IF EXISTS public.partner_retry_resy_booking(uuid);

-- ============================================================
-- 4. Drop partner RLS policies
-- ============================================================

DROP POLICY IF EXISTS "restaurants: partner update own" ON public.restaurants;
DROP POLICY IF EXISTS "availability: read own restaurant" ON public.partner_availability;
DROP POLICY IF EXISTS "availability: insert own restaurant" ON public.partner_availability;
DROP POLICY IF EXISTS "availability: admin write" ON public.partner_availability;
DROP POLICY IF EXISTS "menu_items: partner write own" ON public.restaurant_menu_items;

-- ============================================================
-- 5. Drop partner_availability table
-- ============================================================

DROP TABLE IF EXISTS public.partner_availability;

-- ============================================================
-- 6. Drop payouts table
-- ============================================================

DROP TABLE IF EXISTS public.payouts;

-- ============================================================
-- 7. Drop partner columns from restaurants
-- ============================================================

ALTER TABLE public.restaurants DROP COLUMN IF EXISTS stripe_account;
ALTER TABLE public.restaurants DROP COLUMN IF EXISTS partner_email;

-- ============================================================
-- 8. Simplify restaurants RLS — remove partner_email exception
-- ============================================================

DROP POLICY IF EXISTS "restaurants: read active" ON public.restaurants;

CREATE POLICY "restaurants: read active"
  ON public.restaurants FOR SELECT
  USING (
    is_active = true
    AND auth.role() = 'authenticated'
    AND NOT EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.restaurant_id = restaurants.id
        AND e.is_mystery
        AND e.event_date > now()
        AND now() < (e.event_date - (e.reveal_hours_before || ' hours')::interval)
    )
  );

-- ============================================================
-- 9. Update get_event_detail to stop stripping dropped columns
-- ============================================================

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
  event_type event_type,
  restaurant jsonb,
  confirmed_covers bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    e.id, e.restaurant_id, e.format, e.status, e.event_date, e.group_size,
    e.price_cents, e.city, e.description, e.is_mystery, e.reveal_hours_before,
    e.published_at, e.early_access_hours, e.event_type,
    CASE
      WHEN (NOT e.is_mystery)
        OR now() >= (e.event_date - (e.reveal_hours_before || ' hours')::interval)
      THEN to_jsonb(r)
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
