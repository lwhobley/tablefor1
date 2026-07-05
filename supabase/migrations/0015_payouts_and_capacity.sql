-- ============================================================
-- PHASE 12: Payout ledger + booking capacity enforcement
-- ============================================================
-- Fixes two review findings:
--   1. settle-payout had no DB record of a transfer, so a retried/duplicate
--      call would transfer the partner's share again. A payouts table with
--      unique(event_id) makes payout idempotent and auditable.
--   2. Nothing enforced group_size server-side, so two concurrent checkouts
--      could both confirm past capacity. A trigger enforces it at the
--      point a booking is confirmed.


-- ---------- payouts (idempotency + audit trail for settle-payout) ----------
CREATE TABLE public.payouts (
  id                  uuid primary key default uuid_generate_v4(),
  event_id            uuid not null unique references public.events(id) on delete cascade,
  restaurant_id       uuid not null references public.restaurants(id) on delete cascade,
  covers              int not null,
  gross_cents         bigint not null,
  platform_fee_bps    int not null,
  transferred_cents   bigint not null,
  stripe_transfer_id  text not null,
  created_at          timestamptz not null default now()
);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (which bypasses RLS) writes/reads this.
-- Partners see payout totals through partner_dashboard_stats(), not this table.


-- ---------- booking capacity: enforce group_size at confirmation time ----------
-- Runs BEFORE UPDATE so it can reject the write outright rather than let two
-- concurrent checkout confirmations both land as 'confirmed'.
CREATE OR REPLACE FUNCTION public.enforce_booking_capacity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_group_size int;
  v_confirmed int;
BEGIN
  IF new.status = 'confirmed' AND old.status IS DISTINCT FROM 'confirmed' THEN
    SELECT group_size INTO v_group_size FROM public.events WHERE id = new.event_id FOR UPDATE;

    SELECT count(*) INTO v_confirmed
    FROM public.bookings
    WHERE event_id = new.event_id AND status = 'confirmed' AND id != new.id;

    IF v_confirmed >= v_group_size THEN
      RAISE EXCEPTION 'Event % is already at capacity (% / %)', new.event_id, v_confirmed, v_group_size
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN new;
END;
$$;

CREATE TRIGGER trg_enforce_booking_capacity
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_capacity();
