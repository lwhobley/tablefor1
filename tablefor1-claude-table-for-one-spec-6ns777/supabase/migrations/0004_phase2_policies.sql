-- ============================================================
-- TABLE FOR ONE -- Phase 2 RLS policies
-- ============================================================
-- Two gaps the Phase 2 app code depends on but 0001 never granted:
--   1. Diners can cancel their own still-pending booking.
--   2. Diners can message their group once the match is revealed and
--      before the event (the pre-event chat window). The original
--      "messages: insert if reconnected" policy only covers the
--      post-event reconnect case, so pre-event sends were rejected.
-- Also registers public.messages with the realtime publication so the
-- in-app message subscription receives INSERTs.


-- ---------- bookings: owner cancels own pending booking ----------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bookings'
      and policyname = 'bookings: owner cancel own'
  ) then
    create policy "bookings: owner cancel own"
      on public.bookings for update
      using (auth.uid() = user_id and status = 'pending')
      with check (auth.uid() = user_id and status in ('pending', 'cancelled'));
  end if;
end $$;


-- ---------- messages: insert once match is revealed (pre-event) ----------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages'
      and policyname = 'messages: insert when revealed'
  ) then
    create policy "messages: insert when revealed"
      on public.messages for insert
      with check (
        auth.uid() = sender_id
        and exists (
          select 1
          from public.matches m
          join public.events e on e.id = m.event_id
          where m.id = messages.match_id
            and auth.uid() = any(m.user_ids)
            and m.revealed_at is not null
            and e.event_date > now()
        )
      );
  end if;
end $$;


-- ---------- realtime: stream message inserts to subscribers ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
