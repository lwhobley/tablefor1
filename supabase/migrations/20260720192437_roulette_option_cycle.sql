ALTER TABLE public.roulette_opt_ins
  ADD COLUMN IF NOT EXISTS preferred_event_id uuid
    REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS passed_event_ids uuid[] NOT NULL DEFAULT '{}';

DROP POLICY IF EXISTS "roulette_opt_ins: update own preference" ON public.roulette_opt_ins;

CREATE POLICY "roulette_opt_ins: update own preference"
  ON public.roulette_opt_ins FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND status = 'pending'
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND status = 'pending'
  );

REVOKE UPDATE ON public.roulette_opt_ins FROM authenticated;
GRANT UPDATE (preferred_event_id, passed_event_ids)
  ON public.roulette_opt_ins TO authenticated;

CREATE INDEX roulette_opt_ins_preferred_event_idx
  ON public.roulette_opt_ins(preferred_event_id)
  WHERE preferred_event_id IS NOT NULL;

DROP POLICY IF EXISTS "roulette_opt_ins: insert own" ON public.roulette_opt_ins;

CREATE POLICY "roulette_opt_ins: insert own"
  ON public.roulette_opt_ins FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND date >= current_date
    AND date <= current_date + 14
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND COALESCE(u.travel_city, u.city) = roulette_opt_ins.city
        AND u.is_active
        AND u.trust_score >= 70
        AND public.is_premium_active(u.is_premium, u.premium_expires_at)
    )
  );
