-- ============================================================
-- PHASE 13: RLS security fixes
-- ============================================================


-- ---------- dinner_stories: fix insert-policy column-scoping bug ----------
-- The original policy's EXISTS subquery wrote `b.event_id = event_id`,
-- which Postgres resolves as `b.event_id = bookings.event_id` (a bare
-- column reference inside a subquery binds to the innermost matching
-- table first) — i.e. always true. Any user with one confirmed booking
-- anywhere could insert a story row against ANY event. Fix: qualify the
-- outer reference explicitly.
DROP POLICY IF EXISTS "stories: insert own" ON public.dinner_stories;

CREATE POLICY "stories: insert own"
  ON public.dinner_stories FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.event_id = dinner_stories.event_id
        AND b.user_id = auth.uid()
        AND b.status = 'confirmed'
    )
  );


-- ---------- plus_one_invites: remove invite-code enumeration ----------
-- "invites: read by code" let any authenticated user SELECT the entire
-- table (sender_id, invite_code, invitee_id for every invite in the
-- system), not just the one they're trying to claim. Replace it with a
-- SECURITY DEFINER lookup that only returns a single row scoped to the
-- exact code + event pair the caller already knows, mirroring what
-- useVerifyInviteCode in the client actually needs.
DROP POLICY IF EXISTS "invites: read by code" ON public.plus_one_invites;

CREATE OR REPLACE FUNCTION public.lookup_plus_one_invite(p_invite_code text, p_event_id uuid)
RETURNS TABLE (
  id uuid,
  sender_id uuid,
  event_id uuid,
  invite_code text,
  invitee_id uuid,
  used_at timestamptz,
  sender_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.sender_id, i.event_id, i.invite_code, i.invitee_id, i.used_at, u.name
  FROM public.plus_one_invites i
  JOIN public.users u ON u.id = i.sender_id
  WHERE i.invite_code = upper(trim(p_invite_code))
    AND i.event_id = p_event_id;
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_plus_one_invite(text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.lookup_plus_one_invite(text, uuid) TO authenticated;


-- ---------- city_votes: remove full-table read, add aggregate RPC ----------
-- "city_votes: read by anyone authenticated" exposed every user's individual
-- voting record. useExpansionCities only ever needs per-city counts + "did
-- I vote", both of which an aggregate RPC can return without exposing rows.
DROP POLICY IF EXISTS "city_votes: read by anyone authenticated" ON public.city_votes;

CREATE POLICY "city_votes: read own"
  ON public.city_votes FOR SELECT
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_expansion_cities_with_votes()
RETURNS TABLE (
  city text,
  target_pledges int,
  description text,
  current_pledges bigint,
  has_voted boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.city,
    c.target_pledges,
    c.description,
    count(v.user_id) AS current_pledges,
    bool_or(v.user_id = auth.uid()) AS has_voted
  FROM public.expansion_cities c
  LEFT JOIN public.city_votes v ON v.city = c.city
  GROUP BY c.city, c.target_pledges, c.description
  ORDER BY c.city;
$$;

REVOKE EXECUTE ON FUNCTION public.get_expansion_cities_with_votes() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_expansion_cities_with_votes() TO authenticated;


-- ---------- checkins bucket: make private, serve via signed URLs ----------
-- Trust & safety selfies (real people, known place/time) were in a public
-- bucket with a guessable path. Flip to private; the app must request a
-- signed URL (see lib/uploadCheckin.ts / lib/queries.ts useMyCheckin).
UPDATE storage.buckets SET public = false WHERE id = 'checkins';

DROP POLICY IF EXISTS "checkins: public read" ON storage.objects;

CREATE POLICY "checkins: read own or match members"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'checkins'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1
        FROM public.checkins c
        JOIN public.bookings b ON b.id = c.booking_id
        JOIN public.matches m ON m.event_id = b.event_id
        WHERE c.selfie_url LIKE '%' || name
          AND auth.uid() = ANY (m.user_ids)
          AND c.user_id = ANY (m.user_ids)
      )
    )
  );


-- ---------- matches: index user_ids for the `@>`/contains lookups ----------
-- useMyMatches / RLS "matches: read own" both filter on
-- `auth.uid() = any(user_ids)` / `.contains("user_ids", [userId])`, which
-- was a full sequential scan with no index to support it.
CREATE INDEX IF NOT EXISTS idx_matches_user_ids ON public.matches USING gin (user_ids);


-- ---------- trust/streak/badge RPCs: stop taking an arbitrary target uuid ----------
-- recalculate_trust_score / recalculate_streak / get_badge_counts were
-- SECURITY DEFINER and granted to `authenticated` while accepting ANY
-- user id, so any signed-in user could force-recalculate or read another
-- user's trust score. Redefine them to always operate on auth.uid();
-- get_badge_counts keeps a uuid parameter since badge counts are public
-- (shown on other diners' profiles) but the recalculation functions do not.
CREATE OR REPLACE FUNCTION public.recalculate_trust_score()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_total_past int;
  v_checked_in int;
  v_score int;
BEGIN
  SELECT count(*) INTO v_total_past
  FROM public.bookings b
  JOIN public.events e ON e.id = b.event_id
  WHERE b.user_id = v_user_id
    AND b.status = 'confirmed'
    AND e.event_date < now();

  SELECT count(*) INTO v_checked_in
  FROM public.checkins c
  JOIN public.bookings b ON b.id = c.booking_id
  WHERE b.user_id = v_user_id;

  IF v_total_past = 0 THEN
    v_score := 100;
  ELSE
    v_score := round(100.0 * least(v_checked_in, v_total_past) / v_total_past);
  END IF;

  UPDATE public.users
  SET trust_score = v_score,
      no_show_count = greatest(v_total_past - v_checked_in, 0)
  WHERE id = v_user_id;

  RETURN v_score;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_streak()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_streak int := 0;
  v_row record;
BEGIN
  FOR v_row IN
    SELECT
      b.id AS booking_id,
      e.event_date,
      CASE
        WHEN EXISTS (SELECT 1 FROM public.checkins c WHERE c.booking_id = b.id) THEN true
        ELSE coalesce(f.showed_up, true)
      END AS showed_up
    FROM public.bookings b
    JOIN public.events e ON e.id = b.event_id
    LEFT JOIN public.matches m ON m.event_id = e.id AND v_user_id = any(m.user_ids)
    LEFT JOIN public.feedback f ON f.match_id = m.id AND f.reviewer_id = v_user_id
    WHERE b.user_id = v_user_id
      AND b.status = 'confirmed'
      AND e.status = 'completed'
    ORDER BY e.event_date DESC
  LOOP
    IF v_row.showed_up THEN
      v_streak := v_streak + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  UPDATE public.users
  SET streak_count = v_streak, streak_updated_at = now()
  WHERE id = v_user_id;

  RETURN v_streak;
END;
$$;

-- Drop the old uuid-parameter overloads now that callers use the
-- no-argument, auth.uid()-scoped versions above.
DROP FUNCTION IF EXISTS public.recalculate_trust_score(uuid);
DROP FUNCTION IF EXISTS public.recalculate_streak(uuid);

REVOKE EXECUTE ON FUNCTION public.recalculate_trust_score() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.recalculate_streak() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.recalculate_trust_score() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_streak() TO authenticated;

-- recalculate_plus_one_tokens has the same shape (SECURITY DEFINER, takes a
-- target uuid) but is only ever called internally by create_plus_one_invite
-- / claim_plus_one_invite / the booking triggers with a trusted id, never
-- directly from client code with a user-supplied id — so it's left as-is
-- aside from tightening its grant.
REVOKE EXECUTE ON FUNCTION public.recalculate_plus_one_tokens(uuid) FROM authenticated, anon, public;


-- ---------- close the default-PUBLIC-execute gap on other RPCs ----------
-- Postgres grants EXECUTE on a new function to PUBLIC by default. Migrations
-- 0007/0009/0010/0013 added `GRANT EXECUTE ... TO authenticated` but never
-- revoked the default PUBLIC grant, so `anon` (unauthenticated) callers may
-- still have been able to invoke these RPCs directly over PostgREST despite
-- the intent to restrict them to signed-in users. auth.uid() would resolve
-- to null for those calls, so this was lower severity than the issues
-- above, but it's still an unintended anon-callable admin/user surface.
REVOKE EXECUTE ON FUNCTION public.get_badge_counts(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.partner_retry_resy_booking(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_plus_one_invite(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_plus_one_invite(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.toggle_window_seat_preference() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_badge_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_retry_resy_booking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_plus_one_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_plus_one_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_window_seat_preference() TO authenticated;
