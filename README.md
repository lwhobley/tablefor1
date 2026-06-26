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
2. In the SQL editor, paste and run `supabase/migrations/0001_init.sql`.
   This creates the full Phase 1–3 schema, enables RLS, and provisions the
   public `avatars` storage bucket with owner-scoped write policies.
3. In **Authentication → URL Configuration**, add your dev and prod URLs
   (e.g. `http://localhost:8081`, `https://your-app.vercel.app`) as
   redirect URLs.
4. Copy the project URL + anon key into `.env`.

The `handle_new_auth_user` trigger creates a matching row in `public.users`
the first time someone confirms a magic link, so the app never has to
race-create profile rows.

## Routing

```
app/
  _layout.tsx           # providers + auth gate (redirects based on session/onboarding)
  index.tsx             # entry redirect
  (auth)/
    login.tsx           # magic link form
  auth/
    callback.tsx        # web magic-link landing
  (onboarding)/
    name → photo → food → personality → city
  (tabs)/
    home.tsx            # upcoming events placeholder feed
    profile.tsx         # editable profile
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

## What's next

- **Phase 2** — events, Stripe checkout, matching Edge Function, in-app
  messaging, Resend confirmations
- **Phase 3** — restaurant partner portal, Stripe Connect payouts
