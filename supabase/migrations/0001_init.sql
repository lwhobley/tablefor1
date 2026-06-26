-- ============================================================
-- TABLE FOR ONE — Supabase Schema + RLS Policies
-- Stack: Postgres 15, Supabase Auth, Row Level Security
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- fuzzy search on names/cuisine


-- ============================================================
-- ENUMS
-- ============================================================

create type event_format as enum ('dinner', 'brunch', 'late_night', 'food_crawl', 'chefs_table');
create type event_status as enum ('open', 'matched', 'full', 'cancelled', 'completed');
create type booking_status as enum ('pending', 'confirmed', 'cancelled', 'refunded');
create type energy_level as enum ('low_key', 'balanced', 'high_energy');
create type conv_style as enum ('listener', 'balanced', 'storyteller');
create type dietary as enum ('none', 'vegetarian', 'vegan', 'halal', 'kosher', 'gluten_free', 'dairy_free');
create type feedback_rating as enum ('1', '2', '3', '4', '5');


-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================

create table public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text not null,
  photo_url       text,
  bio             text,
  city            text not null,
  neighborhood    text,
  energy_level    energy_level not null default 'balanced',
  conv_style      conv_style not null default 'balanced',
  food_prefs      text[]    not null default '{}',
  dietary         dietary[] not null default '{}',
  languages       text[]    not null default '{en}',
  is_active       boolean   not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users: read own row"
  on public.users for select
  using (auth.uid() = id);

create policy "users: update own row"
  on public.users for update
  using (auth.uid() = id);

create policy "users: insert own row"
  on public.users for insert
  with check (auth.uid() = id);


-- ============================================================
-- RESTAURANTS (managed by admin / partner portal)
-- ============================================================

create table public.restaurants (
  id               uuid primary key default uuid_generate_v4(),
  name             text not null,
  neighborhood     text not null,
  city             text not null,
  address          text not null,
  cuisine          text[]  not null default '{}',
  capacity         int     not null check (capacity > 0),
  stripe_account   text,                       -- Stripe Connect account ID
  partner_email    text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.restaurants enable row level security;

-- Anyone authenticated can read active restaurants
create policy "restaurants: read active"
  on public.restaurants for select
  using (is_active = true and auth.role() = 'authenticated');

-- Only service_role (admin / Edge Functions) can write
create policy "restaurants: admin write"
  on public.restaurants for all
  using (auth.role() = 'service_role');


-- ============================================================
-- EVENTS
-- ============================================================

create table public.events (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  format          event_format  not null default 'dinner',
  status          event_status  not null default 'open',
  event_date      timestamptz   not null,
  group_size      int           not null default 4 check (group_size between 2 and 8),
  price_cents     int           not null check (price_cents > 0),
  city            text          not null,
  description     text,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

alter table public.events enable row level security;

-- Authenticated users can browse open/matched events
create policy "events: read open"
  on public.events for select
  using (
    auth.role() = 'authenticated'
    and status in ('open', 'matched', 'full', 'completed')
  );

-- Only service_role writes events
create policy "events: admin write"
  on public.events for all
  using (auth.role() = 'service_role');


-- ============================================================
-- BOOKINGS
-- ============================================================

create table public.bookings (
  id                  uuid primary key default uuid_generate_v4(),
  event_id            uuid not null references public.events(id) on delete cascade,
  user_id             uuid not null references public.users(id) on delete cascade,
  status              booking_status not null default 'pending',
  stripe_session_id   text,
  stripe_payment_id   text,
  amount_cents        int not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (event_id, user_id)    -- one booking per user per event
);

alter table public.bookings enable row level security;

-- Users read only their own bookings
create policy "bookings: read own"
  on public.bookings for select
  using (auth.uid() = user_id);

-- Users can insert their own bookings (Stripe confirms via Edge Function)
create policy "bookings: insert own"
  on public.bookings for insert
  with check (auth.uid() = user_id);

-- Only service_role updates status (Stripe webhook handler)
create policy "bookings: service update"
  on public.bookings for update
  using (auth.role() = 'service_role');


-- ============================================================
-- MATCHES (assigned by run-matching Edge Function)
-- ============================================================

create table public.matches (
  id              uuid primary key default uuid_generate_v4(),
  event_id        uuid not null references public.events(id) on delete cascade,
  user_ids        uuid[] not null,              -- array of matched user IDs
  score           numeric(5,2),                 -- composite match score
  revealed_at     timestamptz,                  -- when match info was sent
  created_at      timestamptz not null default now()
);

alter table public.matches enable row level security;

-- Users can see matches they belong to
create policy "matches: read own"
  on public.matches for select
  using (auth.uid() = any(user_ids));

-- Only service_role creates/updates matches
create policy "matches: service write"
  on public.matches for all
  using (auth.role() = 'service_role');


-- ============================================================
-- FEEDBACK (post-event)
-- ============================================================

create table public.feedback (
  id              uuid primary key default uuid_generate_v4(),
  match_id        uuid not null references public.matches(id) on delete cascade,
  reviewer_id     uuid not null references public.users(id) on delete cascade,
  rating          feedback_rating not null,
  showed_up       boolean not null default true,
  reconnect       boolean not null default false,  -- opt in to reconnect
  notes           text,
  created_at      timestamptz not null default now(),
  unique (match_id, reviewer_id)
);

alter table public.feedback enable row level security;

-- Users read only feedback they submitted
create policy "feedback: read own"
  on public.feedback for select
  using (auth.uid() = reviewer_id);

-- Users insert their own feedback
create policy "feedback: insert own"
  on public.feedback for insert
  with check (auth.uid() = reviewer_id);


-- ============================================================
-- MESSAGES (mutual opt-in matches only)
-- ============================================================

create table public.messages (
  id              uuid primary key default uuid_generate_v4(),
  match_id        uuid not null references public.matches(id) on delete cascade,
  sender_id       uuid not null references public.users(id) on delete cascade,
  body            text not null check (char_length(body) <= 2000),
  created_at      timestamptz not null default now()
);

alter table public.messages enable row level security;

-- Only users in the match can read messages
create policy "messages: read if in match"
  on public.messages for select
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id
      and auth.uid() = any(m.user_ids)
    )
  );

-- Only users in the match AND who opted to reconnect can send
create policy "messages: insert if reconnected"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.matches m
      where m.id = match_id
      and auth.uid() = any(m.user_ids)
    )
    and exists (
      select 1 from public.feedback f
      where f.match_id = messages.match_id
      and f.reviewer_id = auth.uid()
      and f.reconnect = true
    )
  );


-- ============================================================
-- PARTNER AVAILABILITY (restaurant submits open slots)
-- ============================================================

create table public.partner_availability (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  proposed_date   timestamptz not null,
  format          event_format not null,
  max_covers      int not null,
  notes           text,
  is_approved     boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table public.partner_availability enable row level security;

-- Partners read their own availability slots (matched by email)
create policy "availability: read own restaurant"
  on public.partner_availability for select
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id
      and r.partner_email = auth.email()
    )
  );

-- Partners can insert availability
create policy "availability: insert own restaurant"
  on public.partner_availability for insert
  with check (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id
      and r.partner_email = auth.email()
    )
  );

-- Admin approves slots
create policy "availability: admin write"
  on public.partner_availability for update
  using (auth.role() = 'service_role');


-- ============================================================
-- INDEXES
-- ============================================================

create index idx_events_city_date    on public.events(city, event_date);
create index idx_events_status       on public.events(status);
create index idx_bookings_event      on public.bookings(event_id);
create index idx_bookings_user       on public.bookings(user_id);
create index idx_matches_event       on public.matches(event_id);
create index idx_messages_match      on public.messages(match_id, created_at);
create index idx_feedback_match      on public.feedback(match_id);
create index idx_users_city          on public.users(city);
create index idx_availability_rest   on public.partner_availability(restaurant_id);


-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();

create trigger trg_events_updated_at
  before update on public.events
  for each row execute function public.handle_updated_at();

create trigger trg_bookings_updated_at
  before update on public.bookings
  for each row execute function public.handle_updated_at();

create trigger trg_restaurants_updated_at
  before update on public.restaurants
  for each row execute function public.handle_updated_at();


-- ============================================================
-- NEW USER TRIGGER (auto-create public.users on auth signup)
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, name, city)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'New member'),
    coalesce(new.raw_user_meta_data->>'city', 'Houston')
  );
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- STORAGE BUCKETS (run in Supabase dashboard or via API)
-- ============================================================

-- insert into storage.buckets (id, name, public)
-- values ('avatars', 'avatars', true);

-- create policy "avatars: public read"
--   on storage.objects for select
--   using (bucket_id = 'avatars');

-- create policy "avatars: user upload"
--   on storage.objects for insert
--   with check (
--     bucket_id = 'avatars'
--     and auth.uid()::text = (storage.foldername(name))[1]
--   );

-- create policy "avatars: user delete own"
--   on storage.objects for delete
--   using (
--     bucket_id = 'avatars'
--     and auth.uid()::text = (storage.foldername(name))[1]
--   );
