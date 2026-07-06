-- ============================================================
-- TABLE FOR 2 — Resy Settings & Booking Controls for Partners
-- ============================================================

-- ---------- partner_upcoming_events() redefinition ----------
-- Redefines the RPC to return Resy status, token, and error fields.
drop function if exists public.partner_upcoming_events();

create or replace function public.partner_upcoming_events()
returns table (
  event_id uuid,
  event_date timestamptz,
  format event_format,
  status event_status,
  group_size int,
  price_cents int,
  confirmed_covers bigint,
  first_names text[],
  resy_booking_status text,
  resy_booking_token text,
  resy_error text
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
    ) as first_names,
    e.resy_booking_status,
    e.resy_booking_token,
    e.resy_error
  from public.events e
  join public.restaurants r on r.id = e.restaurant_id
  left join public.bookings b on b.event_id = e.id
  left join public.users u on u.id = b.user_id
  where r.partner_email = auth.email()
    and e.event_date >= now()
  group by e.id
  order by e.event_date asc;
$func$;

-- ---------- partner_retry_resy_booking() ----------
-- Securely resets an event's Resy booking status to 'pending' to trigger the sniper again.
create or replace function public.partner_retry_resy_booking(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  -- Enforce that the caller owns the restaurant associated with the event
  if exists (
    select 1
    from public.events e
    join public.restaurants r on r.id = e.restaurant_id
    where e.id = p_event_id and r.partner_email = auth.email()
  ) then
    update public.events
    set resy_booking_status = 'pending',
        resy_error = null,
        resy_booking_token = null
    where id = p_event_id;
  else
    raise exception 'Unauthorized to retry booking for this event';
  end if;
end;
$func$;

grant execute on function public.partner_retry_resy_booking(uuid) to authenticated;
