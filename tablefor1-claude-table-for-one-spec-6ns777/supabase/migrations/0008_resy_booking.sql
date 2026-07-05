-- ============================================================
-- TABLE FOR ONE — Resy Reservation Booking Integration
-- ============================================================

-- ---------- restaurants: add resy_venue_id ----------
ALTER TABLE public.restaurants 
ADD COLUMN resy_venue_id text;

-- ---------- events: add Resy booking tracking ----------
ALTER TABLE public.events
ADD COLUMN resy_booking_status text DEFAULT 'none' CHECK (resy_booking_status IN ('none', 'pending', 'booked', 'failed')),
ADD COLUMN resy_booking_token text,
ADD COLUMN resy_error text;

-- ---------- index: support rapid cron queries ----------
CREATE INDEX idx_events_resy_pending 
ON public.events(resy_booking_status) 
WHERE resy_booking_status = 'pending';
