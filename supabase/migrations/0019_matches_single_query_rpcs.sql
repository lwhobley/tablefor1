-- ============================================================
-- PHASE 16: Collapse the matches N+1 into single-query RPCs
-- ============================================================
-- useMyMatches previously issued 1 + 2*N queries (list, then diners+event
-- per match via Promise.all). These RPCs build the same shape server-side
-- in one round trip, using the new GIN index on matches.user_ids from
-- migration 0016.

CREATE OR REPLACE FUNCTION public.get_my_matches()
RETURNS TABLE (
  id uuid,
  event_id uuid,
  user_ids uuid[],
  score numeric,
  revealed_at timestamptz,
  created_at timestamptz,
  diners jsonb,
  event jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    m.id, m.event_id, m.user_ids, m.score, m.revealed_at, m.created_at,
    (SELECT jsonb_agg(to_jsonb(u)) FROM public.users u WHERE u.id = ANY(m.user_ids)) AS diners,
    (
      SELECT jsonb_build_object(
        'id', e.id, 'restaurant_id', e.restaurant_id, 'format', e.format, 'status', e.status,
        'event_date', e.event_date, 'group_size', e.group_size, 'price_cents', e.price_cents,
        'city', e.city, 'description', e.description, 'is_mystery', e.is_mystery,
        'reveal_hours_before', e.reveal_hours_before,
        'restaurant', jsonb_build_object('name', r.name, 'neighborhood', r.neighborhood, 'cuisine', r.cuisine)
      )
      FROM public.events e JOIN public.restaurants r ON r.id = e.restaurant_id
      WHERE e.id = m.event_id
    ) AS event
  FROM public.matches m
  WHERE auth.uid() = ANY(m.user_ids)
  ORDER BY m.revealed_at DESC NULLS LAST;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_matches() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_matches() TO authenticated;


CREATE OR REPLACE FUNCTION public.get_match_detail(p_match_id uuid)
RETURNS TABLE (
  id uuid,
  event_id uuid,
  user_ids uuid[],
  score numeric,
  revealed_at timestamptz,
  created_at timestamptz,
  diners jsonb,
  event jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    m.id, m.event_id, m.user_ids, m.score, m.revealed_at, m.created_at,
    (SELECT jsonb_agg(to_jsonb(u)) FROM public.users u WHERE u.id = ANY(m.user_ids)) AS diners,
    (
      SELECT jsonb_build_object(
        'id', e.id, 'restaurant_id', e.restaurant_id, 'format', e.format, 'status', e.status,
        'event_date', e.event_date, 'group_size', e.group_size, 'price_cents', e.price_cents,
        'city', e.city, 'description', e.description, 'is_mystery', e.is_mystery,
        'reveal_hours_before', e.reveal_hours_before,
        'restaurant', jsonb_build_object('name', r.name, 'neighborhood', r.neighborhood, 'cuisine', r.cuisine)
      )
      FROM public.events e JOIN public.restaurants r ON r.id = e.restaurant_id
      WHERE e.id = m.event_id
    ) AS event
  FROM public.matches m
  WHERE m.id = p_match_id AND auth.uid() = ANY(m.user_ids);
$$;

REVOKE EXECUTE ON FUNCTION public.get_match_detail(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_match_detail(uuid) TO authenticated;
