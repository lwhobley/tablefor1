ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz;
