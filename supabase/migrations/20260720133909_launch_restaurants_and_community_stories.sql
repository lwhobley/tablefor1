-- Editorial stories are authored by Table for 2, not impersonated members.
ALTER TABLE public.dinner_stories
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN author_name text,
  ADD COLUMN is_featured boolean NOT NULL DEFAULT false;

ALTER TABLE public.dinner_stories
  ADD CONSTRAINT dinner_stories_author_check
  CHECK (user_id IS NOT NULL OR nullif(btrim(author_name), '') IS NOT NULL);

INSERT INTO public.restaurants (
  name, neighborhood, city, address, cuisine, capacity, is_active
)
SELECT seed.name, seed.neighborhood, 'Houston',
  'Venue details shared with confirmed diners', seed.cuisine, seed.capacity, true
FROM (VALUES
  ('Table for 2 Supper Club - Montrose', 'Montrose', ARRAY['New American', 'Seasonal']::text[], 24),
  ('Table for 2 Supper Club - The Heights', 'The Heights', ARRAY['Southern', 'Contemporary']::text[], 24),
  ('Table for 2 Supper Club - Downtown', 'Downtown', ARRAY['Latin', 'Shared Plates']::text[], 30)
) AS seed(name, neighborhood, cuisine, capacity)
WHERE NOT EXISTS (
  SELECT 1 FROM public.restaurants existing
  WHERE existing.name = seed.name AND existing.city = 'Houston'
);

-- Upcoming launch tables. Descriptions are stable idempotency keys.
INSERT INTO public.events (
  restaurant_id, format, status, event_date, group_size, price_cents, city,
  description, is_mystery, reveal_hours_before, published_at, early_access_hours
)
SELECT r.id, 'dinner', 'open',
  ((current_date + 3) + time '19:00') AT TIME ZONE 'America/Chicago',
  6, 6500, 'Houston', 'Montrose seasonal supper for six', false, 2,
  now() - interval '2 days', 24
FROM public.restaurants r
WHERE r.name = 'Table for 2 Supper Club - Montrose'
  AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.description = 'Montrose seasonal supper for six');

INSERT INTO public.events (
  restaurant_id, format, status, event_date, group_size, price_cents, city,
  description, is_mystery, reveal_hours_before, published_at, early_access_hours
)
SELECT r.id, 'brunch', 'open',
  ((current_date + 6) + time '11:30') AT TIME ZONE 'America/Chicago',
  6, 4800, 'Houston', 'Heights Sunday brunch table', false, 2,
  now() - interval '2 days', 24
FROM public.restaurants r
WHERE r.name = 'Table for 2 Supper Club - The Heights'
  AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.description = 'Heights Sunday brunch table');

INSERT INTO public.events (
  restaurant_id, format, status, event_date, group_size, price_cents, city,
  description, is_mystery, reveal_hours_before, published_at, early_access_hours
)
SELECT r.id, 'dinner', 'open',
  ((current_date + 9) + time '19:30') AT TIME ZONE 'America/Chicago',
  8, 7200, 'Houston', 'Downtown shared-plates night', true, 3,
  now() - interval '2 days', 24
FROM public.restaurants r
WHERE r.name = 'Table for 2 Supper Club - Downtown'
  AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.description = 'Downtown shared-plates night');

INSERT INTO public.events (
  restaurant_id, format, status, event_date, group_size, price_cents, city,
  description, is_mystery, reveal_hours_before, published_at, early_access_hours
)
SELECT r.id, 'chefs_table', 'open',
  ((current_date + 13) + time '19:00') AT TIME ZONE 'America/Chicago',
  6, 8900, 'Houston', 'Montrose chef-led tasting table', false, 2,
  now() - interval '2 days', 24
FROM public.restaurants r
WHERE r.name = 'Table for 2 Supper Club - Montrose'
  AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.description = 'Montrose chef-led tasting table');

INSERT INTO public.events (
  restaurant_id, format, status, event_date, group_size, price_cents, city,
  description, is_mystery, reveal_hours_before, published_at, early_access_hours
)
SELECT r.id, 'food_crawl', 'open',
  ((current_date + 17) + time '18:30') AT TIME ZONE 'America/Chicago',
  8, 7600, 'Houston', 'Heights neighborhood food crawl', false, 2,
  now() - interval '2 days', 24
FROM public.restaurants r
WHERE r.name = 'Table for 2 Supper Club - The Heights'
  AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.description = 'Heights neighborhood food crawl');

INSERT INTO public.events (
  restaurant_id, format, status, event_date, group_size, price_cents, city,
  description, is_mystery, reveal_hours_before, published_at, early_access_hours
)
SELECT r.id, 'late_night', 'open',
  ((current_date + 20) + time '21:00') AT TIME ZONE 'America/Chicago',
  6, 5500, 'Houston', 'Downtown late-night table', false, 2,
  now() - interval '2 days', 24
FROM public.restaurants r
WHERE r.name = 'Table for 2 Supper Club - Downtown'
  AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.description = 'Downtown late-night table');

-- Completed editorial events give each community story real event context.
INSERT INTO public.events (
  restaurant_id, format, status, event_date, group_size, price_cents, city,
  description, is_mystery, reveal_hours_before, published_at, early_access_hours
)
SELECT r.id, 'dinner', 'completed', now() - interval '28 days', 6, 6500,
  'Houston', 'Community story: monthly supper club', false, 2,
  now() - interval '35 days', 24
FROM public.restaurants r
WHERE r.name = 'Table for 2 Supper Club - Montrose'
  AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.description = 'Community story: monthly supper club');

INSERT INTO public.events (
  restaurant_id, format, status, event_date, group_size, price_cents, city,
  description, is_mystery, reveal_hours_before, published_at, early_access_hours
)
SELECT r.id, 'dinner', 'completed', now() - interval '19 days', 6, 6800,
  'Houston', 'Community story: new-to-Houston friendship', true, 2,
  now() - interval '26 days', 24
FROM public.restaurants r
WHERE r.name = 'Table for 2 Supper Club - Downtown'
  AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.description = 'Community story: new-to-Houston friendship');

INSERT INTO public.events (
  restaurant_id, format, status, event_date, group_size, price_cents, city,
  description, is_mystery, reveal_hours_before, published_at, early_access_hours
)
SELECT r.id, 'brunch', 'completed', now() - interval '11 days', 6, 4800,
  'Houston', 'Community story: first-timer brunch', false, 2,
  now() - interval '18 days', 24
FROM public.restaurants r
WHERE r.name = 'Table for 2 Supper Club - The Heights'
  AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.description = 'Community story: first-timer brunch');

INSERT INTO public.dinner_stories (
  event_id, user_id, author_name, is_featured, photo_url, caption, created_at
)
SELECT e.id, NULL, 'Table for 2 Community', true,
  'https://raw.githubusercontent.com/lwhobley/tablefor1/main/assets/images/intro_table_meeting.png',
  'Four strangers arrived with different stories and left planning a monthly supper club. The table stayed talking long after dessert.',
  e.event_date + interval '3 hours'
FROM public.events e
WHERE e.description = 'Community story: monthly supper club'
  AND NOT EXISTS (SELECT 1 FROM public.dinner_stories s WHERE s.caption = 'Four strangers arrived with different stories and left planning a monthly supper club. The table stayed talking long after dessert.');

INSERT INTO public.dinner_stories (
  event_id, user_id, author_name, is_featured, photo_url, caption, created_at
)
SELECT e.id, NULL, 'Table for 2 Community', true,
  'https://raw.githubusercontent.com/lwhobley/tablefor1/main/assets/images/intro_dish_one.png',
  'A mystery dinner became a real friendship when two guests discovered they had moved to Houston the same week. They now explore a new neighborhood together every month.',
  e.event_date + interval '3 hours'
FROM public.events e
WHERE e.description = 'Community story: new-to-Houston friendship'
  AND NOT EXISTS (SELECT 1 FROM public.dinner_stories s WHERE s.caption = 'A mystery dinner became a real friendship when two guests discovered they had moved to Houston the same week. They now explore a new neighborhood together every month.');

INSERT INTO public.dinner_stories (
  event_id, user_id, author_name, is_featured, photo_url, caption, created_at
)
SELECT e.id, NULL, 'Table for 2 Community', true,
  'https://raw.githubusercontent.com/lwhobley/tablefor1/main/assets/images/intro_dish_two.png',
  'One quiet first-timer nearly canceled. By the end of brunch, the whole table had traded numbers and booked another Sunday together.',
  e.event_date + interval '3 hours'
FROM public.events e
WHERE e.description = 'Community story: first-timer brunch'
  AND NOT EXISTS (SELECT 1 FROM public.dinner_stories s WHERE s.caption = 'One quiet first-timer nearly canceled. By the end of brunch, the whole table had traded numbers and booked another Sunday together.');

CREATE INDEX idx_dinner_stories_featured
  ON public.dinner_stories (is_featured, created_at DESC)
  WHERE is_featured = true;
