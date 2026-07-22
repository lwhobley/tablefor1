-- ============================================================
-- REVIEW HARDENING ROUND 3
-- ============================================================
-- Closes the DB-side findings from the third full-repo review:
--   1. payouts.stripe_transfer_id must be nullable so settle-payout can
--      claim the payout row BEFORE creating the Stripe transfer (the
--      idempotency key alone expires after 24h — the DB row is the
--      durable double-payout guard).
--   2. get_my_matches / get_match_detail leaked the mystery restaurant's
--      identity unconditionally — the exact leak 0018 closed for the
--      events RPCs, reintroduced by 0019/0020's match RPCs.
--   3. useMutualSparks / useReconnectRequests embedded users joins that
--      RLS silently nulls (users is own-row-only), crashing both tabs.
--      Scoped SECURITY DEFINER RPCs expose just id/name/photo_url of the
--      counterparty, mirroring get_event_attendees.
--   4. claim_plus_one_invite had a check-then-act race: two users could
--      both pass the invitee_id IS NULL check and the second silently
--      overwrote the first. Claim atomically in one guarded UPDATE.
--   5. The 'stories' storage bucket was fully public (same bug 0016
--      fixed for 'checkins'): real people's dinner photos served by the
--      CDN with zero auth. Flip private + authenticated-read policy;
--      the client now displays via signed URLs.
--   6. events.resy_booking_token / resy_error were readable by every
--      authenticated user via the base-table policy. Column-scope the
--      SELECT grant (same pattern 0020 used for users UPDATE).
--   7. The base restaurants table ignored mystery state entirely, so a
--      direct PostgREST read resolved any mystery event's restaurant_id
--      to its name, bypassing every RPC-level mask. Hide a restaurant
--      row while it has an un-revealed future mystery event.
--   8. restaurant_perks ignored premium_only — premium-exclusive perk
--      content was readable by free users.


-- ---------- 1. payouts: claim-first settle flow ----------
ALTER TABLE public.payouts ALTER COLUMN stripe_transfer_id DROP NOT NULL;


-- ---------- 2. match RPCs: mask the mystery restaurant ----------
-- Same reveal predicate as get_upcoming_events / get_event_detail (0018).
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
    (SELECT jsonb_agg(public.safe_profile_json(u)) FROM public.users u WHERE u.id = ANY(m.user_ids)) AS diners,
    (
      SELECT jsonb_build_object(
        'id', e.id, 'restaurant_id', e.restaurant_id, 'format', e.format, 'status', e.status,
        'event_date', e.event_date, 'group_size', e.group_size, 'price_cents', e.price_cents,
        'city', e.city, 'description', e.description, 'is_mystery', e.is_mystery,
        'reveal_hours_before', e.reveal_hours_before,
        'restaurant', CASE
          WHEN (NOT e.is_mystery)
            OR now() >= (e.event_date - (e.reveal_hours_before || ' hours')::interval)
          THEN jsonb_build_object('name', r.name, 'neighborhood', r.neighborhood, 'cuisine', r.cuisine)
          ELSE NULL
        END
      )
      FROM public.events e JOIN public.restaurants r ON r.id = e.restaurant_id
      WHERE e.id = m.event_id
    ) AS event
  FROM public.matches m
  WHERE auth.uid() = ANY(m.user_ids)
  ORDER BY m.revealed_at DESC NULLS LAST;
$$;

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
    (SELECT jsonb_agg(public.safe_profile_json(u)) FROM public.users u WHERE u.id = ANY(m.user_ids)) AS diners,
    (
      SELECT jsonb_build_object(
        'id', e.id, 'restaurant_id', e.restaurant_id, 'format', e.format, 'status', e.status,
        'event_date', e.event_date, 'group_size', e.group_size, 'price_cents', e.price_cents,
        'city', e.city, 'description', e.description, 'is_mystery', e.is_mystery,
        'reveal_hours_before', e.reveal_hours_before,
        'restaurant', CASE
          WHEN (NOT e.is_mystery)
            OR now() >= (e.event_date - (e.reveal_hours_before || ' hours')::interval)
          THEN jsonb_build_object('name', r.name, 'neighborhood', r.neighborhood, 'cuisine', r.cuisine)
          ELSE NULL
        END
      )
      FROM public.events e JOIN public.restaurants r ON r.id = e.restaurant_id
      WHERE e.id = m.event_id
    ) AS event
  FROM public.matches m
  WHERE m.id = p_match_id AND auth.uid() = ANY(m.user_ids);
$$;


-- ---------- 3. RPCs replacing the RLS-nulled users embeds ----------
CREATE OR REPLACE FUNCTION public.get_my_reconnect_requests()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  target_user_id uuid,
  status text,
  event_id uuid,
  created_at timestamptz,
  sender jsonb,
  recipient jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    rr.id, rr.user_id, rr.target_user_id, rr.status, rr.event_id, rr.created_at,
    jsonb_build_object('id', su.id, 'name', su.name, 'photo_url', su.photo_url) AS sender,
    jsonb_build_object('id', tu.id, 'name', tu.name, 'photo_url', tu.photo_url) AS recipient
  FROM public.reconnect_requests rr
  JOIN public.users su ON su.id = rr.user_id
  JOIN public.users tu ON tu.id = rr.target_user_id
  WHERE auth.uid() IN (rr.user_id, rr.target_user_id)
  ORDER BY rr.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_reconnect_requests() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_reconnect_requests() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_mutual_sparks()
RETURNS TABLE (
  match_id uuid,
  target_user_id uuid,
  target jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    s.match_id, s.target_user_id,
    jsonb_build_object('id', u.id, 'name', u.name, 'photo_url', u.photo_url) AS target
  FROM public.sparks s
  JOIN public.sparks back
    ON back.match_id = s.match_id
   AND back.user_id = s.target_user_id
   AND back.target_user_id = s.user_id
   AND back.sparked
  JOIN public.users u ON u.id = s.target_user_id
  WHERE s.user_id = auth.uid() AND s.sparked;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_mutual_sparks() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_mutual_sparks() TO authenticated;


-- ---------- 4. claim_plus_one_invite: atomic claim ----------
-- The claim itself is now a single guarded UPDATE — two racing claimants
-- serialize on the row lock and exactly one sees invitee_id IS NULL.
CREATE OR REPLACE FUNCTION public.claim_plus_one_invite(p_invite_code text)
RETURNS public.plus_one_invites
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite public.plus_one_invites;
BEGIN
  UPDATE public.plus_one_invites
  SET invitee_id = auth.uid()
  WHERE invite_code = upper(trim(p_invite_code))
    AND invitee_id IS NULL
    AND used_at IS NULL
    AND sender_id <> auth.uid()
  RETURNING * INTO v_invite;

  IF v_invite.id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.plus_one_invites
      WHERE invite_code = upper(trim(p_invite_code)) AND sender_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'You cannot claim your own invite.';
    END IF;
    RAISE EXCEPTION 'Invalid or already claimed invite code.';
  END IF;

  RETURN v_invite;
END;
$$;


-- ---------- 5. stories bucket: private + signed URLs ----------
UPDATE storage.buckets SET public = false WHERE id = 'stories';

DROP POLICY IF EXISTS "stories_storage: public read" ON storage.objects;

CREATE POLICY "stories_storage: authenticated read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'stories');


-- ---------- 6. events: column-scope SELECT (hide Resy internals) ----------
-- Postgres grants table-wide SELECT by default; scope it so the Resy
-- booking token / error diagnostics are only reachable via the service
-- role and the partner RPCs (SECURITY DEFINER), never raw PostgREST.
REVOKE SELECT ON public.events FROM authenticated, anon;
GRANT SELECT (
  id, restaurant_id, format, status, event_date, group_size, price_cents,
  city, description, created_at, updated_at,
  is_mystery, reveal_hours_before,
  published_at, early_access_hours,
  theme, vibe_tags, dress_code, host_name, is_signature
) ON public.events TO authenticated;


-- ---------- 7. restaurants: hide identity while a mystery is unrevealed ----------
-- Anyone could read events.restaurant_id off a mystery event and resolve
-- the name from the restaurants table directly. Hide the restaurant row
-- while it has an un-revealed FUTURE mystery event (partner still sees
-- their own row). Residual: a restaurant simultaneously hosting a
-- revealed public event stays visible — operators should not schedule a
-- public and an unrevealed mystery dinner at the same venue concurrently.
DROP POLICY IF EXISTS "restaurants: read active" ON public.restaurants;

CREATE POLICY "restaurants: read active"
  ON public.restaurants FOR SELECT
  USING (
    is_active = true
    AND auth.role() = 'authenticated'
    AND (
      partner_email = auth.email()
      OR NOT EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.restaurant_id = restaurants.id
          AND e.is_mystery
          AND e.event_date > now()
          AND now() < (e.event_date - (e.reveal_hours_before || ' hours')::interval)
      )
    )
  );


-- ---------- 8. restaurant_perks: enforce premium_only server-side ----------
DROP POLICY IF EXISTS "restaurant_perks: read active" ON public.restaurant_perks;

CREATE POLICY "restaurant_perks: read active"
  ON public.restaurant_perks FOR SELECT TO authenticated
  USING (
    is_active
    AND active_from <= now()
    AND (active_until IS NULL OR active_until > now())
    AND (
      NOT premium_only
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.is_premium
          AND (u.premium_expires_at IS NULL OR u.premium_expires_at > now())
      )
    )
  );
