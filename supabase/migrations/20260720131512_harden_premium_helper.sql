-- Keep the Premium status helper independent of caller-controlled schemas.
ALTER FUNCTION public.is_premium_active(boolean, timestamptz)
  SET search_path = '';
