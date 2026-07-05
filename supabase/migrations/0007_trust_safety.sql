-- ============================================================
-- PHASE 6: Trust & Safety — Check-ins, Waitlist, Reputation Badges
-- ============================================================
-- Depends on 0005 (users.streak_count) and 0006 (events.is_mystery).
-- Apply 0005, 0006, 0007 in order.


-- ============================================================
-- CHECK-INS (selfie confirmation at the table)
-- ============================================================

create table public.checkins (
  id              uuid primary key default uuid_generate_v4(),
  booking_id      uuid not null references public.bookings(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  selfie_url      text not null,
  checked_in_at   timestamptz not null default now(),
  unique (booking_id)
);

alter table public.checkins enable row level security;

create policy "checkins: read own"
  on public.checkins for select
  using (auth.uid() = user_id);

-- Diners in the same match can see who else checked in.
create policy "checkins: read match members"
  on public.checkins for select
  using (
    exists (
      select 1 from public.bookings b
      join public.matches m on m.event_id = b.event_id
      where b.id = checkins.booking_id
        and auth.uid() = any(m.user_ids)
        and checkins.user_id = any(m.user_ids)
    )
  );

create policy "checkins: insert own"
  on public.checkins for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.user_id = auth.uid() and b.status = 'confirmed'
    )
  );

create index idx_checkins_user on public.checkins(user_id);


-- ============================================================
-- TRUST SCORE + NO-SHOW TRACKING
-- ============================================================

alter table public.users
  add column trust_score int not null default 100 check (trust_score between 0 and 100),
  add column no_show_count int not null default 0;

create or replace function public.recalculate_trust_score(p_user_id uuid)
returns int language plpgsql security definer as $$
declare
  v_total_past int;
  v_checked_in int;
  v_score int;
begin
  select count(*) into v_total_past
  from public.bookings b
  join public.events e on e.id = b.event_id
  where b.user_id = p_user_id
    and b.status = 'confirmed'
    and e.event_date < now();

  select count(*) into v_checked_in
  from public.checkins c
  join public.bookings b on b.id = c.booking_id
  where b.user_id = p_user_id;

  if v_total_past = 0 then
    v_score := 100;
  else
    v_score := round(100.0 * least(v_checked_in, v_total_past) / v_total_past);
  end if;

  update public.users
  set trust_score = v_score,
      no_show_count = greatest(v_total_past - v_checked_in, 0)
  where id = p_user_id;

  return v_score;
end;
$$;

grant execute on function public.recalculate_trust_score(uuid) to authenticated;

-- Prefer check-in presence over self-reported feedback when computing the
-- attendance streak (more reliable signal now that we have it).
create or replace function public.recalculate_streak(p_user_id uuid)
returns int language plpgsql security definer as $$
declare
  v_streak int := 0;
  v_row record;
begin
  for v_row in
    select
      b.id as booking_id,
      e.event_date,
      case
        when exists (select 1 from public.checkins c where c.booking_id = b.id) then true
        else coalesce(f.showed_up, true)
      end as showed_up
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

grant execute on function public.recalculate_streak(uuid) to authenticated;


-- ============================================================
-- WAITLIST (no-show insurance)
-- ============================================================

create table public.event_waitlist (
  id            uuid primary key default uuid_generate_v4(),
  event_id      uuid not null references public.events(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  notified_at   timestamptz,
  unique (event_id, user_id)
);

alter table public.event_waitlist enable row level security;

create policy "waitlist: read own"
  on public.event_waitlist for select
  using (auth.uid() = user_id);

create policy "waitlist: insert own"
  on public.event_waitlist for insert
  with check (auth.uid() = user_id);

create policy "waitlist: delete own"
  on public.event_waitlist for delete
  using (auth.uid() = user_id);

create index idx_waitlist_event on public.event_waitlist(event_id, created_at);

-- When a confirmed booking is cancelled and frees a spot, flag everyone
-- still waiting so the app can surface a "spot opened up" banner. There's
-- no push/email infra yet, so this is a poll-on-open signal, not a push.
create or replace function public.notify_waitlist_on_cancel()
returns trigger language plpgsql security definer as $$
declare
  v_group_size int;
  v_confirmed int;
begin
  if new.status = 'cancelled' and old.status = 'confirmed' then
    select group_size into v_group_size from public.events where id = new.event_id;
    select count(*) into v_confirmed from public.bookings
      where event_id = new.event_id and status = 'confirmed';

    if v_confirmed < v_group_size then
      update public.event_waitlist
      set notified_at = now()
      where event_id = new.event_id and notified_at is null;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_notify_waitlist_on_cancel
  after update on public.bookings
  for each row execute function public.notify_waitlist_on_cancel();


-- ============================================================
-- DINER REPUTATION BADGES (peer-given tags)
-- ============================================================

create table public.diner_tags (
  id            uuid primary key default uuid_generate_v4(),
  match_id      uuid not null references public.matches(id) on delete cascade,
  rater_id      uuid not null references public.users(id) on delete cascade,
  ratee_id      uuid not null references public.users(id) on delete cascade,
  tag           text not null check (tag in (
    'great_conversationalist', 'good_listener', 'adventurous_eater',
    'always_on_time', 'generous', 'funny', 'great_energy'
  )),
  created_at    timestamptz not null default now(),
  unique (match_id, rater_id, ratee_id, tag)
);

alter table public.diner_tags enable row level security;

create policy "diner_tags: read own given"
  on public.diner_tags for select
  using (auth.uid() = rater_id);

create policy "diner_tags: insert own"
  on public.diner_tags for insert
  with check (
    auth.uid() = rater_id
    and rater_id != ratee_id
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and auth.uid() = any(m.user_ids)
        and ratee_id = any(m.user_ids)
    )
  );

create policy "diner_tags: delete own given"
  on public.diner_tags for delete
  using (auth.uid() = rater_id);

create index idx_diner_tags_ratee on public.diner_tags(ratee_id, tag);

-- Aggregate badge counts without exposing who gave them.
create or replace function public.get_badge_counts(p_user_id uuid)
returns table (tag text, count bigint)
language sql stable security definer as $$
  select tag, count(*) as count
  from public.diner_tags
  where ratee_id = p_user_id
  group by tag
  order by count(*) desc;
$$;

grant execute on function public.get_badge_counts(uuid) to authenticated;


-- ============================================================
-- STORAGE BUCKET FOR CHECK-IN SELFIES
-- ============================================================

insert into storage.buckets (id, name, public)
values ('checkins', 'checkins', true)
on conflict (id) do nothing;

create policy "checkins: public read"
  on storage.objects for select
  using (bucket_id = 'checkins');

create policy "checkins: user upload own"
  on storage.objects for insert
  with check (
    bucket_id = 'checkins'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
