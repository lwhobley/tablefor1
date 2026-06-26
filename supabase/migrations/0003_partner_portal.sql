-- ============================================================
-- TABLE FOR ONE — Partner portal helpers
-- ============================================================
-- Adds:
--   * an UPDATE policy so partners can edit their own restaurant row
--   * three SECURITY DEFINER SQL functions the partner UI calls via PostgREST
--     RPC. They sidestep the bookings RLS (which scopes by user_id) while
--     enforcing partner scoping internally with `partner_email = auth.email()`.
--     This lets partners see cover counts + first names for their events
--     without exposing any other diner PII.


-- ---------- restaurants: partner update own ----------
create policy "restaurants: partner update own"
  on public.restaurants for update
  using (partner_email = auth.email())
  with check (partner_email = auth.email());


-- ---------- partner_my_restaurant() ----------
-- Returns the single restaurant row owned by the calling partner, or null.
create or replace function public.partner_my_restaurant()
returns public.restaurants
language sql
security definer
set search_path = public
stable
as $func$
  select *
  from public.restaurants
  where partner_email = auth.email()
  limit 1;
$func$;


-- ---------- partner_upcoming_events() ----------
-- Per-event roll-up for the partner's upcoming dates. confirmed_covers and
-- first_names come from joins to bookings + users; the bookings RLS would
-- block this for the partner role, so we run the function as definer.
create or replace function public.partner_upcoming_events()
returns table (
  event_id uuid,
  event_date timestamptz,
  format event_format,
  status event_status,
  group_size int,
  price_cents int,
  confirmed_covers bigint,
  first_names text[]
)
language sql
security definer
set search_path = public
stable
as $func$
  select
    e.id,
    e.event_date,
    e.format,
    e.status,
    e.group_size,
    e.price_cents,
    coalesce(count(b.id) filter (where b.status = 'confirmed'), 0)::bigint
      as confirmed_covers,
    coalesce(
      array_agg(split_part(u.name, ' ', 1))
        filter (where b.status = 'confirmed' and u.name is not null),
      ARRAY[]::text[]
    ) as first_names
  from public.events e
  join public.restaurants r on r.id = e.restaurant_id
  left join public.bookings b on b.event_id = e.id
  left join public.users u on u.id = b.user_id
  where r.partner_email = auth.email()
    and e.event_date >= now()
  group by e.id
  order by e.event_date asc;
$func$;


-- ---------- partner_dashboard_stats() ----------
-- One-row snapshot of the next 30 days for the dashboard header.
-- gross_payout_cents is the sum of confirmed booking prices over that window;
-- the partner's actual share is computed by `settle-payout` after the event
-- completes (currently a flat 80%).
create or replace function public.partner_dashboard_stats()
returns table (
  upcoming_events bigint,
  confirmed_covers bigint,
  pending_slots bigint,
  gross_payout_cents bigint
)
language sql
security definer
set search_path = public
stable
as $func$
  select
    coalesce((
      select count(*) from public.events e
      join public.restaurants r on r.id = e.restaurant_id
      where r.partner_email = auth.email()
        and e.event_date between now() and now() + interval '30 days'
    ), 0)::bigint as upcoming_events,
    coalesce((
      select count(*) from public.bookings b
      join public.events e on e.id = b.event_id
      join public.restaurants r on r.id = e.restaurant_id
      where r.partner_email = auth.email()
        and b.status = 'confirmed'
        and e.event_date between now() and now() + interval '30 days'
    ), 0)::bigint as confirmed_covers,
    coalesce((
      select count(*) from public.partner_availability pa
      join public.restaurants r on r.id = pa.restaurant_id
      where r.partner_email = auth.email() and not pa.is_approved
    ), 0)::bigint as pending_slots,
    coalesce((
      select sum(e.price_cents)::bigint
      from public.bookings b
      join public.events e on e.id = b.event_id
      join public.restaurants r on r.id = e.restaurant_id
      where r.partner_email = auth.email()
        and b.status = 'confirmed'
        and e.event_date between now() and now() + interval '30 days'
    ), 0) as gross_payout_cents;
$func$;


-- ---------- grants ----------
-- These RPCs are SECURITY DEFINER and gate on auth.email() internally. We
-- still revoke from anon/public so unauthenticated callers can't probe the
-- /rest/v1/rpc/* endpoints, then grant explicitly to authenticated.
revoke execute on function public.partner_my_restaurant()      from anon, public;
revoke execute on function public.partner_upcoming_events()    from anon, public;
revoke execute on function public.partner_dashboard_stats()    from anon, public;
grant execute on function public.partner_my_restaurant()       to authenticated;
grant execute on function public.partner_upcoming_events()     to authenticated;
grant execute on function public.partner_dashboard_stats()     to authenticated;
