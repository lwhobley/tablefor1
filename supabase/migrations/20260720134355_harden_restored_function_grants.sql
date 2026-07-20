-- Supabase may retain explicit anon grants even after revoking PUBLIC.
-- User-facing RPCs are authenticated-only; trigger/internal functions are
-- never callable through PostgREST.
REVOKE EXECUTE ON FUNCTION public.claim_plus_one_invite(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_plus_one_invite(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_badge_counts(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_mutual_spark(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_mutual_spark(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.partner_retry_resy_booking(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.partner_upcoming_events() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.toggle_window_seat_preference() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.claim_plus_one_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_plus_one_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_badge_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_mutual_spark(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_mutual_spark(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_retry_resy_booking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_upcoming_events() TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_window_seat_preference() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_booking_cancelled_invite() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_booking_confirmed_invite() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_waitlist_on_cancel() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_booking_plus_one_invite() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.safe_profile_json(public.users) FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.claim_plus_one_invite(text) SET search_path = public;
ALTER FUNCTION public.create_plus_one_invite(uuid) SET search_path = public;
ALTER FUNCTION public.get_badge_counts(uuid) SET search_path = public;
ALTER FUNCTION public.handle_booking_cancelled_invite() SET search_path = public;
ALTER FUNCTION public.handle_booking_confirmed_invite() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.recalculate_plus_one_tokens(uuid) SET search_path = public;
ALTER FUNCTION public.toggle_window_seat_preference() SET search_path = public;
ALTER FUNCTION public.enforce_booking_capacity() SET search_path = public;
ALTER FUNCTION public.event_in_early_access(timestamptz, integer) SET search_path = '';
