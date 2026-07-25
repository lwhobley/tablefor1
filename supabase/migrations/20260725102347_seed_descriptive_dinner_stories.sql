-- Give the launch feed a fuller set of editorial community moments. These
-- rows use named table groups rather than fabricated member accounts.
WITH event_seed (
  description, restaurant_name, format, days_ago, event_time,
  group_size, price_cents, is_mystery
) AS (
  VALUES
    ('Community story: Montrose creative night', 'Table for 2 Supper Club - Montrose', 'dinner'::event_format, 62, time '19:00', 6, 6500, false),
    ('Community story: Heights birthday brunch', 'Table for 2 Supper Club - The Heights', 'brunch'::event_format, 55, time '11:30', 6, 4800, false),
    ('Community story: Downtown mystery table', 'Table for 2 Supper Club - Downtown', 'dinner'::event_format, 48, time '19:30', 8, 7200, true),
    ('Community story: Montrose chefs counter', 'Table for 2 Supper Club - Montrose', 'chefs_table'::event_format, 42, time '18:30', 6, 8900, false),
    ('Community story: Heights newcomer dinner', 'Table for 2 Supper Club - The Heights', 'dinner'::event_format, 36, time '19:00', 6, 6200, false),
    ('Community story: Downtown quiet table', 'Table for 2 Supper Club - Downtown', 'dinner'::event_format, 31, time '19:30', 6, 6800, false),
    ('Community story: Heights food crawl', 'Table for 2 Supper Club - The Heights', 'food_crawl'::event_format, 24, time '18:00', 8, 7600, false),
    ('Community story: Montrose rainy night', 'Table for 2 Supper Club - Montrose', 'dinner'::event_format, 17, time '19:00', 6, 6500, false),
    ('Community story: Downtown late night', 'Table for 2 Supper Club - Downtown', 'late_night'::event_format, 9, time '21:00', 6, 5500, false),
    ('Community story: Heights Sunday reset', 'Table for 2 Supper Club - The Heights', 'brunch'::event_format, 4, time '11:00', 6, 4800, false)
)
INSERT INTO public.events (
  restaurant_id, format, status, event_date, group_size, price_cents, city,
  description, is_mystery, reveal_hours_before, published_at, early_access_hours
)
SELECT
  restaurant.id,
  seed.format,
  'completed',
  ((current_date - seed.days_ago) + seed.event_time) AT TIME ZONE 'America/Chicago',
  seed.group_size,
  seed.price_cents,
  'Houston',
  seed.description,
  seed.is_mystery,
  2,
  now() - ((seed.days_ago + 7) * interval '1 day'),
  24
FROM event_seed seed
JOIN public.restaurants restaurant ON restaurant.name = seed.restaurant_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.events existing WHERE existing.description = seed.description
);

WITH story_seed (
  event_description, author_name, is_featured, photo_file, caption
) AS (
  VALUES
    (
      'Community story: Montrose creative night',
      'The Montrose Thursday Table',
      true,
      'restaurant_courtyard.png',
      'The table began with six people comparing favorite neighborhood restaurants and ended with a shared note full of gallery openings, coffee shops, and recipes to trade. Dessert had been cleared for nearly an hour when they finally noticed the dining room was emptying around them.'
    ),
    (
      'Community story: Heights birthday brunch',
      'The Heights Sunday Crew',
      true,
      'restaurant_glasshouse.png',
      'One guest mentioned that it was her birthday only after everyone had ordered. The table quietly asked the kitchen for candles, turned a casual brunch into a full celebration, and made sure she left with six new contacts and plans for a museum afternoon.'
    ),
    (
      'Community story: Downtown mystery table',
      'Downtown Table Eight',
      true,
      'restaurant_rooftop.png',
      'Nobody knew the restaurant until the reveal, and nobody at the table had met before that evening. A conversation about first jobs became stories about career changes, difficult leaps, and the people who made them possible. Three guests stayed for one last drink on the rooftop.'
    ),
    (
      'Community story: Montrose chefs counter',
      'The Chefs Counter Crew',
      false,
      'restaurant_chefs_table.png',
      'Each course came with a story from the chef, so the table answered with food memories of its own: a grandmother''s Sunday sauce, midnight noodles after college exams, and the first meal cooked in a new apartment. By the final course, everyone had exchanged a recipe.'
    ),
    (
      'Community story: Heights newcomer dinner',
      'New to Houston Table',
      true,
      'restaurant_supper_club.png',
      'Four guests had moved to Houston within the same year, each from a different city. They compared the small rituals that helped a new place feel like home, then created a group map of markets, parks, and late-night food stops to explore together over the next month.'
    ),
    (
      'Community story: Downtown quiet table',
      'The Quiet Table',
      false,
      'restaurant_izakaya.png',
      'This table was intentionally matched for people who prefer thoughtful conversation over a loud room. The pace stayed easy, pauses never felt awkward, and a question about favorite books unfolded into an honest discussion about rest, ambition, and making space for friendships as an adult.'
    ),
    (
      'Community story: Heights food crawl',
      'The Neighborhood Crawl Crew',
      true,
      'intro_dish_one.png',
      'The group crossed three blocks and tried something different at every stop, passing plates so nobody had to choose just one dish. They kept a running ranking in the chat, disagreed cheerfully about dessert, and scheduled a rematch in another neighborhood before the night was over.'
    ),
    (
      'Community story: Montrose rainy night',
      'The Rainy Night Table',
      false,
      'intro_table_meeting.png',
      'A sudden storm kept everyone under the restaurant awning after dinner. Instead of rushing for rides, the group ordered tea, pulled their chairs closer, and traded the kind of stories that usually take several meetings to reach. The rain stopped before the conversation did.'
    ),
    (
      'Community story: Downtown late night',
      'The Late-Night Table',
      false,
      'intro_dish_two.png',
      'The reservation started at nine, but the energy felt more like the beginning of an evening than the end of one. Shared plates led to a spirited debate about the city''s best live music, and the table walked together to a nearby set recommended by their server.'
    ),
    (
      'Community story: Heights Sunday reset',
      'The Sunday Reset Table',
      true,
      'restaurant_courtyard.png',
      'Everyone arrived carrying a busy week. Over coffee and warm biscuits, the table talked about the routines that help them reset, from long walks to phone-free mornings. They left lighter, with a shared playlist and a standing invitation for the first Sunday of next month.'
    )
)
INSERT INTO public.dinner_stories (
  event_id, user_id, author_name, is_featured, photo_url, caption, created_at
)
SELECT
  event.id,
  NULL,
  seed.author_name,
  seed.is_featured,
  'https://raw.githubusercontent.com/lwhobley/tablefor1/main/assets/images/' || seed.photo_file,
  seed.caption,
  event.event_date + interval '3 hours'
FROM story_seed seed
JOIN public.events event ON event.description = seed.event_description
WHERE NOT EXISTS (
  SELECT 1
  FROM public.dinner_stories existing
  WHERE existing.event_id = event.id
    AND existing.author_name = seed.author_name
    AND existing.caption = seed.caption
);
