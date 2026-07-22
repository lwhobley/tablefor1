-- ============================================================
-- PHASE 4: Vibe Checks, Sparks, and Dinner Streaks
-- ============================================================


-- ============================================================
-- VIBE CHECKS (pre-event swipe interest signals)
-- ============================================================

create table public.vibe_checks (
  id              uuid primary key default uuid_generate_v4(),
  event_id        uuid not null references public.events(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  target_user_id  uuid not null references public.users(id) on delete cascade,
  direction       text not null check (direction in ('like', 'pass')),
  created_at      timestamptz not null default now(),
  unique (event_id, user_id, target_user_id)
);

alter table public.vibe_checks enable row level security;

create policy "vibe_checks: read own"
  on public.vibe_checks for select
  using (auth.uid() = user_id);

create policy "vibe_checks: insert own"
  on public.vibe_checks for insert
  with check (
    auth.uid() = user_id
    and user_id != target_user_id
  );

create index idx_vibe_checks_event_user on public.vibe_checks(event_id, user_id);
create index idx_vibe_checks_mutual on public.vibe_checks(event_id, target_user_id, direction);


-- ============================================================
-- SPARKS (post-dinner mutual interest)
-- ============================================================

create table public.sparks (
  id              uuid primary key default uuid_generate_v4(),
  match_id        uuid not null references public.matches(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  target_user_id  uuid not null references public.users(id) on delete cascade,
  sparked         boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (match_id, user_id, target_user_id)
);

alter table public.sparks enable row level security;

create policy "sparks: read own"
  on public.sparks for select
  using (auth.uid() = user_id);

-- Users can see sparks others gave them (to detect mutual sparks)
create policy "sparks: read received"
  on public.sparks for select
  using (auth.uid() = target_user_id);

create policy "sparks: insert own"
  on public.sparks for insert
  with check (
    auth.uid() = user_id
    and user_id != target_user_id
    and exists (
      select 1 from public.matches m
      where m.id = match_id
      and auth.uid() = any(m.user_ids)
      and target_user_id = any(m.user_ids)
    )
  );

create index idx_sparks_match on public.sparks(match_id);
create index idx_sparks_mutual on public.sparks(match_id, target_user_id, sparked);


-- ============================================================
-- STREAKS (consecutive dinner attendance tracking)
-- ============================================================

-- Streaks are computed from bookings + feedback (showed_up = true).
-- We store a materialized counter on the user profile for fast reads.

alter table public.users
  add column streak_count int not null default 0,
  add column streak_updated_at timestamptz;

-- Function to recalculate a user's streak from confirmed bookings at
-- completed events where they showed up.
create or replace function public.recalculate_streak(p_user_id uuid)
returns int language plpgsql security definer as $$
declare
  v_streak int := 0;
  v_row record;
begin
  -- Walk backwards through completed events the user booked,
  -- counting consecutive ones where they showed up.
  for v_row in
    select
      b.id as booking_id,
      e.event_date,
      coalesce(f.showed_up, true) as showed_up
    from public.bookings b
    join public.events e on e.id = b.event_id
    left join public.matches m on m.event_id = e.id and p_user_id = any(m.user_ids)
    left join public.feedback f on f.match_id = m.id and f.reviewer_id = p_user_id
    where b.user_id = p_user_id
      and b.status = 'confirmed'
      and e.status = 'completed'
    order by e.event_date desc
  loop
    if v_row.showed_up then
      v_streak := v_streak + 1;
    else
      exit;
    end if;
  end loop;

  update public.users
  set streak_count = v_streak, streak_updated_at = now()
  where id = p_user_id;

  return v_streak;
end;
$$;


-- ============================================================
-- MUTUAL SPARK HELPER (check if two users sparked each other)
-- ============================================================

create or replace function public.is_mutual_spark(p_match_id uuid, p_user_a uuid, p_user_b uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.sparks
    where match_id = p_match_id
      and user_id = p_user_a and target_user_id = p_user_b and sparked = true
  ) and exists (
    select 1 from public.sparks
    where match_id = p_match_id
      and user_id = p_user_b and target_user_id = p_user_a and sparked = true
  );
$$;


-- ============================================================
-- UPDATE MESSAGES POLICY: Allow messaging on mutual spark
-- (supplement existing reconnect-based policy)
-- ============================================================

create policy "messages: insert if mutual spark"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.matches m
      where m.id = match_id
      and auth.uid() = any(m.user_ids)
    )
    and exists (
      select 1 from public.sparks s1
      join public.sparks s2
        on s2.match_id = s1.match_id
        and s2.user_id = s1.target_user_id
        and s2.target_user_id = s1.user_id
        and s2.sparked = true
      where s1.match_id = messages.match_id
        and s1.user_id = auth.uid()
        and s1.sparked = true
    )
  );


-- ============================================================
-- VIBE CHECK: read other users booked for the same event
-- (needed so users can see profiles to swipe on)
-- ============================================================

create policy "users: read fellow event attendees"
  on public.users for select
  using (
    exists (
      select 1 from public.bookings b1
      join public.bookings b2 on b1.event_id = b2.event_id
      where b1.user_id = auth.uid()
        and b2.user_id = users.id
        and b1.status = 'confirmed'
        and b2.status = 'confirmed'
    )
  );
