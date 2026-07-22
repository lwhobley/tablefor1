-- ============================================================
-- PHASE 8: City Expansion Voting
-- ============================================================

-- ---------- expansion_cities table ----------
CREATE TABLE public.expansion_cities (
  city              text primary key,
  target_pledges    int not null default 100,
  description       text,
  created_at        timestamptz not null default now()
);

ALTER TABLE public.expansion_cities enable row level security;

CREATE POLICY "expansion_cities: read by anyone authenticated"
  ON public.expansion_cities FOR SELECT
  USING (auth.role() = 'authenticated');

-- ---------- city_votes table ----------
CREATE TABLE public.city_votes (
  id            uuid primary key default uuid_generate_v4(),
  city          text not null references public.expansion_cities(city) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (city, user_id)
);

ALTER TABLE public.city_votes enable row level security;

CREATE POLICY "city_votes: read by anyone authenticated"
  ON public.city_votes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "city_votes: insert own vote"
  ON public.city_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "city_votes: delete own vote"
  ON public.city_votes FOR DELETE
  USING (auth.uid() = user_id);

-- ---------- Seed Initial Expansion Cities ----------
INSERT INTO public.expansion_cities (city, target_pledges, description) VALUES
  ('Austin', 100, 'Keep Austin Weird (and well-fed)! We need 100 foodies to pledge before we launch here.'),
  ('Denver', 100, 'Mile-high dining in the Rockies. Help us bring solo dining to the Mile High city.'),
  ('Miami', 150, 'Sunny beaches and vibrant flavors. Pledge to open our first Florida tables.'),
  ('Seattle', 120, 'Rainy coffee shop days call for warm table sharing. Pledge to launch in Seattle.')
ON CONFLICT (city) DO NOTHING;
