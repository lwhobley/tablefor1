-- ============================================================
-- PHASE 16: High-Impact Features Migration
-- Stack: Postgres 15, Supabase Row Level Security, Storage
-- ============================================================

-- ---------- 1. Helper function for mutual sparks ----------
CREATE OR REPLACE FUNCTION public.has_mutual_spark(p_user_a uuid, p_user_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sparks s1
    JOIN public.sparks s2 ON s1.match_id = s2.match_id
    WHERE s1.user_id = p_user_a AND s1.target_user_id = p_user_b AND s1.sparked = true
      AND s2.user_id = p_user_b AND s2.target_user_id = p_user_a AND s2.sparked = true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_mutual_spark(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_mutual_spark(uuid, uuid) TO authenticated;


-- ---------- 2. Dinner Roulette ----------
CREATE TABLE public.roulette_opt_ins (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  city        text not null,
  date        date not null default current_date,
  status      text not null default 'pending' check (status in ('pending', 'matched', 'expired')),
  booking_id  uuid references public.bookings(id) on delete set null,
  created_at  timestamptz not null default now(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_roulette_opt_ins_date_city ON public.roulette_opt_ins(date, city);

ALTER TABLE public.roulette_opt_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roulette_opt_ins: select own"
  ON public.roulette_opt_ins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "roulette_opt_ins: insert own"
  ON public.roulette_opt_ins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "roulette_opt_ins: delete own"
  ON public.roulette_opt_ins FOR DELETE
  USING (auth.uid() = user_id);


-- ---------- 3. Reconnect Dinners ----------
CREATE TABLE public.reconnect_requests (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade, -- sender
  target_user_id  uuid not null references public.users(id) on delete cascade, -- recipient
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  event_id        uuid references public.events(id) on delete set null,
  created_at      timestamptz not null default now(),
  UNIQUE(user_id, target_user_id)
);

ALTER TABLE public.reconnect_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reconnect_requests: select involved"
  ON public.reconnect_requests FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = target_user_id);

CREATE POLICY "reconnect_requests: insert own"
  ON public.reconnect_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.has_mutual_spark(user_id, target_user_id));

CREATE POLICY "reconnect_requests: update involved"
  ON public.reconnect_requests FOR UPDATE
  USING (auth.uid() = target_user_id OR auth.uid() = user_id);


-- ---------- 4. Messages Photo URL Support ----------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS photo_url text;


-- ---------- 5. Message Reactions ----------
CREATE TABLE public.message_reactions (
  id          uuid primary key default uuid_generate_v4(),
  message_id  uuid not null references public.messages(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_reactions: select visible"
  ON public.message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages msg
      JOIN public.matches m ON m.id = msg.match_id
      WHERE msg.id = message_reactions.message_id
        AND auth.uid() = ANY(m.user_ids)
    )
  );

CREATE POLICY "message_reactions: insert own"
  ON public.message_reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.messages msg
      JOIN public.matches m ON m.id = msg.match_id
      WHERE msg.id = message_reactions.message_id
        AND auth.uid() = ANY(m.user_ids)
    )
  );

CREATE POLICY "message_reactions: delete own"
  ON public.message_reactions FOR DELETE
  USING (auth.uid() = user_id);


-- ---------- 6. Chat Photos Storage Bucket ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-photos', 'chat-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "chat-photos: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-photos');

CREATE POLICY "chat-photos: user upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "chat-photos: user update own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'chat-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "chat-photos: user delete own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ---------- 7. Icebreaker Prompts ----------
CREATE TABLE public.icebreaker_prompts (
  id           uuid primary key default uuid_generate_v4(),
  prompt_text  text not null unique
);

ALTER TABLE public.icebreaker_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "icebreaker_prompts: read active"
  ON public.icebreaker_prompts FOR SELECT
  USING (auth.role() = 'authenticated');

INSERT INTO public.icebreaker_prompts (prompt_text) VALUES
  ('My controversial food take is...'),
  ('Best meal I''ve ever had...'),
  ('I''m the person at the table who...'),
  ('My go-to comfort food is...'),
  ('The weirdest thing I''ve ever eaten is...'),
  ('My dream dinner guest would be...')
ON CONFLICT (prompt_text) DO NOTHING;


-- ---------- 8. User Icebreakers ----------
CREATE TABLE public.user_icebreakers (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  prompt_id   uuid not null references public.icebreaker_prompts(id) on delete cascade,
  answer      text not null check (char_length(answer) <= 1000),
  created_at  timestamptz not null default now(),
  UNIQUE(user_id, prompt_id)
);

ALTER TABLE public.user_icebreakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_icebreakers: select visible"
  ON public.user_icebreakers FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE auth.uid() = ANY(m.user_ids)
        AND user_id = ANY(m.user_ids)
    )
  );

CREATE POLICY "user_icebreakers: insert own"
  ON public.user_icebreakers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_icebreakers: update own"
  ON public.user_icebreakers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "user_icebreakers: delete own"
  ON public.user_icebreakers FOR DELETE
  USING (auth.uid() = user_id);
