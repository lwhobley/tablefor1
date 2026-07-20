ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS welcome_email_status text,
  ADD COLUMN IF NOT EXISTS welcome_email_claimed_at timestamptz;

DO $$
BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_welcome_email_status_check
    CHECK (welcome_email_status IN ('sending', 'sent'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Accounts that existed before this delivery flow should not receive a
-- retroactive welcome email on their next sign-in.
UPDATE public.users
SET
  welcome_email_status = 'sent',
  welcome_email_sent_at = COALESCE(welcome_email_sent_at, now()),
  welcome_email_claimed_at = NULL
WHERE welcome_email_status IS NULL;
