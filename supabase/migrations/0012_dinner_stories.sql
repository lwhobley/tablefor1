-- ============================================================
-- PHASE 9: Dinner Stories (BeReal-style photo sharing)
-- ============================================================

-- ---------- dinner_stories table ----------
CREATE TABLE public.dinner_stories (
  id            uuid primary key default uuid_generate_v4(),
  event_id      uuid not null references public.events(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  photo_url     text not null,
  caption       text,
  created_at    timestamptz not null default now(),
  unique (event_id, user_id)
);

ALTER TABLE public.dinner_stories enable row level security;

-- RLS policies for dinner_stories
CREATE POLICY "stories: read by anyone authenticated"
  ON public.dinner_stories FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "stories: insert own"
  ON public.dinner_stories FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      -- Must have a confirmed booking for the event
      SELECT 1 FROM public.bookings b
      WHERE b.event_id = event_id
        AND b.user_id = auth.uid()
        AND b.status = 'confirmed'
    )
  );

CREATE POLICY "stories: delete own"
  ON public.dinner_stories FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_dinner_stories_event ON public.dinner_stories(event_id);
CREATE INDEX idx_dinner_stories_user ON public.dinner_stories(user_id);

-- ---------- storage bucket for dinner stories ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('stories', 'stories', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "stories_storage: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'stories');

CREATE POLICY "stories_storage: user upload own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'stories'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
