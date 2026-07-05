-- ============================================================
-- PHASE 11: Restaurant Favorites & Recommendations
-- ============================================================

-- ---------- favorite_restaurants table ----------
CREATE TABLE public.favorite_restaurants (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (user_id, restaurant_id)
);

ALTER TABLE public.favorite_restaurants enable row level security;

CREATE POLICY "favorites: read own"
  ON public.favorite_restaurants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "favorites: insert own"
  ON public.favorite_restaurants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "favorites: delete own"
  ON public.favorite_restaurants FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_favorite_restaurants_user ON public.favorite_restaurants(user_id);

-- ---------- restaurant_recommendations table ----------
CREATE TABLE public.restaurant_recommendations (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  name            text not null,
  city            text not null,
  neighborhood    text,
  notes           text,
  created_at      timestamptz not null default now()
);

ALTER TABLE public.restaurant_recommendations enable row level security;

CREATE POLICY "recommendations: read own"
  ON public.restaurant_recommendations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "recommendations: insert own"
  ON public.restaurant_recommendations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_restaurant_rec_user ON public.restaurant_recommendations(user_id);
