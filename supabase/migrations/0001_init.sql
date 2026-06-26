-- Table for One — initial schema
-- Phase 1 focuses on users, but the full schema is created here so future
-- phases (events, bookings, matches, restaurants, messages) inherit the same
-- migration history. RLS is enabled everywhere; only the policies needed for
-- Phase 1 are permissive — later phases will add more.

create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type energy_level as enum ('chill', 'balanced', 'spirited');
create type conv_style as enum ('listener', 'storyteller', 'debater', 'curious');
create type event_format as enum ('brunch', 'dinner', 'food_crawl');
create type event_status as enum ('draft', 'open', 'full', 'cancelled', 'completed');
create type booking_status as enum ('pending', 'confirmed', 'cancelled', 'refunded');

-- ---------- restaurants ----------
create table restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  neighborhood text,
  cuisine text[] default '{}',
  capacity int,
  stripe_account text,
  active boolean default true,
  created_at timestamptz default now()
);

-- ---------- users ----------
-- One row per Supabase auth user, keyed by auth.uid().
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  photo_url text,
  city text,
  food_prefs text[] default '{}',
  dietary text[] default '{}',
  energy_level energy_level,
  conv_style conv_style,
  languages text[] default '{}',
  onboarded_at timestamptz,
  created_at timestamptz default now()
);

-- ---------- events ----------
create table events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete set null,
  city text not null,
  starts_at timestamptz not null,
  format event_format not null default 'dinner',
  group_size int not null default 4 check (group_size between 2 and 6),
  price_cents int not null default 2000,
  status event_status not null default 'open',
  created_at timestamptz default now()
);
create index events_city_starts_at_idx on events (city, starts_at);

-- ---------- bookings ----------
create table bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  stripe_session text,
  status booking_status not null default 'pending',
  created_at timestamptz default now(),
  unique (event_id, user_id)
);

-- ---------- matches ----------
create table matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_ids uuid[] not null,
  score numeric(5,2),
  revealed_at timestamptz,
  feedback jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);
create index matches_event_idx on matches (event_id);

-- ---------- messages ----------
create table messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);
create index messages_match_created_idx on messages (match_id, created_at);

-- ---------- auto-create user row on signup ----------
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------- row level security ----------
alter table users        enable row level security;
alter table restaurants  enable row level security;
alter table events       enable row level security;
alter table bookings     enable row level security;
alter table matches      enable row level security;
alter table messages     enable row level security;

-- users: read/write own row only
create policy "users self read"  on users for select using (auth.uid() = id);
create policy "users self write" on users for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "users self insert" on users for insert with check (auth.uid() = id);

-- restaurants: public read of active rows; writes via service role only
create policy "restaurants public read" on restaurants for select using (active);

-- events: public read of open/full events; writes via service role only
create policy "events public read" on events for select using (status in ('open', 'full', 'completed'));

-- bookings: user reads / inserts their own
create policy "bookings self read"   on bookings for select using (auth.uid() = user_id);
create policy "bookings self insert" on bookings for insert with check (auth.uid() = user_id);

-- matches: read only if user is part of the match
create policy "matches self read" on matches for select using (auth.uid() = any(user_ids));

-- messages: read/write only inside a match the user belongs to
create policy "messages self read" on messages for select using (
  exists (
    select 1 from matches m
    where m.id = messages.match_id and auth.uid() = any(m.user_ids)
  )
);
create policy "messages self insert" on messages for insert with check (
  auth.uid() = sender_id and exists (
    select 1 from matches m
    where m.id = messages.match_id and auth.uid() = any(m.user_ids)
  )
);

-- ---------- storage: profile photos ----------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars owner upload"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "avatars owner update"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "avatars owner delete"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
