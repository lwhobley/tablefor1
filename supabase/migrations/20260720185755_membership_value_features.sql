-- Member value features: richer matching preferences, travel mode, curated
-- table metadata, safety workflows, partner perks, group polls, and concierge.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_vibes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS availability text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS travel_city text,
  ADD COLUMN IF NOT EXISTS budget_max_cents int NOT NULL DEFAULT 15000
    CHECK (budget_max_cents BETWEEN 1000 AND 100000),
  ADD COLUMN IF NOT EXISTS max_distance_km int NOT NULL DEFAULT 25
    CHECK (max_distance_km BETWEEN 1 AND 200);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS theme text,
  ADD COLUMN IF NOT EXISTS vibe_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dress_code text,
  ADD COLUMN IF NOT EXISTS host_name text,
  ADD COLUMN IF NOT EXISTS is_signature boolean NOT NULL DEFAULT false;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS menu_url text,
  ADD COLUMN IF NOT EXISTS reservation_url text,
  ADD COLUMN IF NOT EXISTS parking_info text;

UPDATE public.events
SET
  theme = COALESCE(theme, CASE format
    WHEN 'brunch' THEN 'New in Town Brunch'
    WHEN 'late_night' THEN 'After Hours Table'
    WHEN 'food_crawl' THEN 'Neighborhood Adventure'
    WHEN 'chefs_table' THEN 'Food Lovers'' Table'
    ELSE 'Dinner with New Friends'
  END),
  vibe_tags = CASE
    WHEN cardinality(vibe_tags) > 0 THEN vibe_tags
    WHEN format = 'brunch' THEN ARRAY['easygoing', 'new connections']
    WHEN format = 'late_night' THEN ARRAY['lively', 'spontaneous']
    WHEN format = 'food_crawl' THEN ARRAY['adventurous', 'social']
    WHEN format = 'chefs_table' THEN ARRAY['food-focused', 'curious']
    ELSE ARRAY['warm', 'conversational']
  END,
  is_signature = is_signature OR is_mystery OR format = 'chefs_table';

CREATE TABLE public.profile_verifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  method text NOT NULL DEFAULT 'identity_review'
    CHECK (method IN ('identity_review', 'community_review')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE public.profile_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_verifications: read relevant"
  ON public.profile_verifications FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE (SELECT auth.uid()) = ANY(m.user_ids)
        AND profile_verifications.user_id = ANY(m.user_ids)
    )
  );

CREATE POLICY "profile_verifications: request own"
  ON public.profile_verifications FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND status = 'pending');

CREATE TABLE public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_blocks: manage own"
  ON public.user_blocks FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = blocker_id)
  WITH CHECK ((SELECT auth.uid()) = blocker_id);

CREATE TABLE public.safety_reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN (
    'inappropriate_behavior', 'harassment', 'safety_concern',
    'no_show', 'profile_issue', 'other'
  )),
  details text NOT NULL CHECK (char_length(details) BETWEEN 10 AND 4000),
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'reviewing', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.safety_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "safety_reports: read own"
  ON public.safety_reports FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = reporter_id);

CREATE POLICY "safety_reports: submit own"
  ON public.safety_reports FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = reporter_id AND status = 'submitted');

CREATE TABLE public.restaurant_perks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  premium_only boolean NOT NULL DEFAULT false,
  active_from timestamptz NOT NULL DEFAULT now(),
  active_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_perks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restaurant_perks: read active"
  ON public.restaurant_perks FOR SELECT TO authenticated
  USING (
    is_active
    AND active_from <= now()
    AND (active_until IS NULL OR active_until > now())
  );

CREATE TABLE public.match_polls (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question text NOT NULL CHECK (char_length(question) BETWEEN 3 AND 200),
  options text[] NOT NULL CHECK (cardinality(options) BETWEEN 2 AND 6),
  closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.match_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_polls: read match"
  ON public.match_polls FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id AND (SELECT auth.uid()) = ANY(m.user_ids)
  ));

CREATE POLICY "match_polls: create in match"
  ON public.match_polls FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = creator_id
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND (SELECT auth.uid()) = ANY(m.user_ids)
    )
  );

CREATE POLICY "match_polls: delete own"
  ON public.match_polls FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = creator_id);

CREATE TABLE public.match_poll_votes (
  poll_id uuid NOT NULL REFERENCES public.match_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  option_index int NOT NULL CHECK (option_index BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

ALTER TABLE public.match_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_poll_votes: read match"
  ON public.match_poll_votes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.match_polls p
    JOIN public.matches m ON m.id = p.match_id
    WHERE p.id = poll_id AND (SELECT auth.uid()) = ANY(m.user_ids)
  ));

CREATE POLICY "match_poll_votes: insert own"
  ON public.match_poll_votes FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.match_polls p
      JOIN public.matches m ON m.id = p.match_id
      WHERE p.id = poll_id
        AND (SELECT auth.uid()) = ANY(m.user_ids)
        AND option_index < cardinality(p.options)
    )
  );

CREATE POLICY "match_poll_votes: update own"
  ON public.match_poll_votes FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "match_poll_votes: delete own"
  ON public.match_poll_votes FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE TABLE public.concierge_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN (
    'find_a_table', 'private_table', 'travel_planning', 'restaurant_help'
  )),
  details text NOT NULL CHECK (char_length(details) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'in_progress', 'completed', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.concierge_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "concierge_requests: read own"
  ON public.concierge_requests FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "concierge_requests: submit own premium"
  ON public.concierge_requests FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.is_premium
        AND (u.premium_expires_at IS NULL OR u.premium_expires_at > now())
    )
  );

GRANT SELECT, INSERT ON public.profile_verifications TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT SELECT, INSERT ON public.safety_reports TO authenticated;
GRANT SELECT ON public.restaurant_perks TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.match_polls TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_poll_votes TO authenticated;
GRANT SELECT, INSERT ON public.concierge_requests TO authenticated;

GRANT ALL ON public.profile_verifications, public.user_blocks,
  public.safety_reports, public.restaurant_perks, public.match_polls,
  public.match_poll_votes, public.concierge_requests TO service_role;

CREATE INDEX profile_verifications_user_idx ON public.profile_verifications(user_id);
CREATE INDEX user_blocks_blocked_idx ON public.user_blocks(blocked_id);
CREATE INDEX safety_reports_reporter_idx ON public.safety_reports(reporter_id, created_at DESC);
CREATE INDEX restaurant_perks_active_idx ON public.restaurant_perks(restaurant_id, is_active);
CREATE INDEX match_polls_match_idx ON public.match_polls(match_id, created_at DESC);
CREATE INDEX match_poll_votes_poll_idx ON public.match_poll_votes(poll_id);
CREATE INDEX concierge_requests_user_idx ON public.concierge_requests(user_id, created_at DESC);
