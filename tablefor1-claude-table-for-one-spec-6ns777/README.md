# Table for One

Curated solo-diner dinners. Mobile-first web app built with Expo Router,
Supabase, NativeWind, and React Query. This repo currently ships **Phase 1**:
magic-link auth, profile onboarding, editable profile, and a placeholder
home feed.

## Stack

- **Frontend** — Expo Router (web-first), NativeWind, React Query
- **Backend** — Supabase Postgres + Auth + Storage, RLS-locked
- **Deploy** — Vercel (web), Expo EAS later for native

## Quickstart

```bash
npm install
cp .env.example .env
# Fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm run web
```

Open http://localhost:8081 — magic links you send in dev land redirect back
to `/auth/callback`.

## Supabase setup

1. Create a new Supabase project.
2. In the SQL editor, run `supabase/migrations/0001_init.sql` (full
   Phase 1–3 schema, enums, RLS policies, updated_at + new-user triggers).
3. Then run `supabase/migrations/0002_storage.sql` to provision the
   public `avatars` bucket and owner-scoped storage policies.
4. Then run `supabase/migrations/0003_partner_portal.sql` to install the
   partner-scoped SECURITY DEFINER RPCs (`partner_my_restaurant`,
   `partner_upcoming_events`, `partner_dashboard_stats`) and the
   partner-can-edit-own-restaurant policy.
4. In **Authentication → URL Configuration**, add your dev and prod URLs
   (e.g. `http://localhost:8081`, `https://your-app.vercel.app`) as
   redirect URLs.
5. Copy the project URL + anon key into `.env`.

The `handle_new_user` trigger creates a matching `public.users` row the
first time someone confirms a magic link (with placeholder name `'New
member'` and city `'Houston'`), so the app never has to race-create
profile rows. Onboarding completion is tracked in
`auth.users.raw_user_meta_data.onboarded_at` — set on the final
onboarding step via `supabase.auth.updateUser` — so we never have to
guess from partial profile state.

## Routing

```
app/
  _layout.tsx           # providers + diner auth gate (skips /partner/*)
  index.tsx             # entry redirect
  (auth)/
    login.tsx           # magic link form
  auth/
    callback.tsx        # web magic-link landing
  (onboarding)/
    name → photo → food → personality → city
  (tabs)/
    home.tsx            # upcoming events feed
    profile.tsx         # editable profile
  partner/              # Phase 3 partner portal (own auth gate)
    _layout.tsx         # session + restaurants.partner_email check
    login.tsx           # partner magic link
    dashboard.tsx       # 30-day metrics + Stripe Connect prompt
    availability.tsx    # submit + list partner_availability rows
    events.tsx          # upcoming events with cover counts (RPC)
    settings.tsx        # editable venue profile
    connect/
      stripe.tsx        # kicks off Stripe Connect onboarding
```

The auth gate in `app/_layout.tsx` is the single source of truth for who
sees what:

- No session → `/(auth)/login`
- Session, no `onboarded_at` → `/(onboarding)/name`
- Session + onboarded → `/(tabs)/home`

## Photos

Profile photos go to the `avatars` Supabase Storage bucket under
`{userId}/avatar-{timestamp}.{ext}`. The bucket is public-read; writes are
scoped to the owning user via the storage RLS policies in the migration.

## Deploy (Vercel)

```bash
npm run build:web   # outputs to dist/
```

`vercel.json` already pins the build command and SPA rewrites. Add the
two `EXPO_PUBLIC_*` env vars in the Vercel project settings.

## Edge functions (Phase 3 shipped, Phase 2 stubs)

Live under `supabase/functions/`:

| Function | Phase | Trigger |
|---|---|---|
| `approve-availability` | 3 | Admin POST — turns a slot into an event |
| `create-connect-link` | 3 | Partner POST — Stripe Express onboarding URL |
| `settle-payout` | 3 | Admin / cron after event completes |

Deploy with `supabase functions deploy <name>`. They expect the env vars
in `.env.functions.example`:

```bash
cp .env.functions.example supabase/.env
supabase secrets set --env-file supabase/.env
```

## Partner portal

- Magic link login at `/partner/login` keyed on `restaurants.partner_email`.
- The partner layout calls `partner_my_restaurant()` and shows a "no venue
  on file" screen if no row exists, so a diner who signs in here can't
  accidentally see partner UI.
- Dashboard, events, and stats all go through the SECURITY DEFINER RPCs
  added in migration `0003` — they bypass the diner-side bookings RLS but
  scope internally on `partner_email = auth.email()`, so partners only
  ever see counts and first names for diners at their own events.

## What's next

- **Phase 2** — events, Stripe checkout, matching Edge Function, in-app
  messaging, Resend confirmations (schema + storage already in place)
