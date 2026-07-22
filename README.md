# Table for 2

Curated solo-diner dinners. Mobile-first web app built with Expo Router,
Supabase, NativeWind, and React Query. The current product covers the full
dinner journey: discovery, paid booking, smart group matching, coordination,
check-in, feedback, mutual Sparks, reconnect dinners, and member safety.

## Member experience

- Image-led themed and Signature Table discovery with personalized fit reasons
- Matching based on food, dietary needs, social energy, conversation style,
  interests, preferred vibes, availability, trust, and Premium status
- Travel mode, Dinner Roulette, early access, waitlists, and +1 invitations
- Revealed group profiles, real-time chat, photos, reactions, prompts, and polls
- Restaurant menus, directions, calendar export, partner reservation links,
  parking details, favorites, recommendations, and active partner perks
- Check-in selfies, trust scores, profile verification, reporting, and blocking
- Post-dinner feedback, private Sparks, mutual reconnects, stories, and passport
- Premium Signature Tables, private-table requests, and dining concierge

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
2. Run every file in `supabase/migrations/` **in filename order**
   (`0001_init.sql` through the highest-numbered file) via the SQL editor
   or `supabase db push`. Each migration depends on the ones before it —
   see the header comment at the top of each file for what it adds.
   Notably: `0001` is the full Phase 1–3 schema + RLS; `0002` provisions
   the `avatars` bucket; `0003` installs the partner-scoped RPCs; `0015`
   onward add payout idempotency, booking-capacity enforcement, and the
   RLS/security fixes described in their header comments.
3. In **Authentication -> URL Configuration**, add the exact production
   callback `https://tablefour2.vercel.app/auth/callback` plus the local and
   native callback URLs listed in `supabase/config.toml`.
4. In **Authentication -> Sign In / Providers -> Email**, require users to
   confirm their email address. Hosted Auth must report
   `mailer_autoconfirm: false` for confirmation emails to be sent.
5. Set `RESEND_API_KEY`, `WELCOME_FROM_EMAIL`, and optionally
   `AUTH_FROM_EMAIL` / `AUTH_EMAIL_LOGO_URL` as Edge Function secrets.
6. Deploy `auth-send-email` without JWT verification and create an HTTPS
   **Send Email** Auth Hook for its function URL. Save the generated hook
   secret as `SEND_EMAIL_HOOK_SECRET`. The function verifies Supabase's signed
   webhook before sending branded Auth messages through Resend.
7. Deploy `send-welcome-email` with JWT verification enabled. This remains a
   separate post-confirmation message with the full consumer feature guide.
8. Copy the project URL + public anon/publishable key into `.env`.

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
    home.tsx            # personalized upcoming tables
    bookings.tsx        # upcoming and past dinners
    matches.tsx         # revealed groups and chat entry points
    club.tsx            # matching profile, travel mode, Premium, member tools
    profile.tsx         # editable public profile
  passport.tsx          # checked-in dining history
  safety/               # verification, reports, and safety controls
  concierge.tsx         # Premium member-care requests
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

## Edge functions

Live under `supabase/functions/`:

| Function | Trigger |
|---|---|
| `create-checkout-session` | Diner POST — Stripe Checkout for a booking |
| `create-premium-checkout-session` | Diner POST — Stripe Checkout (subscription) for Premium |
| `stripe-webhook` | Stripe → confirms bookings, activates/renews/cancels Premium |
| `create-connect-link` | Partner POST — Stripe Express onboarding URL |
| `approve-availability` | Admin-only — turns a slot into an event |
| `settle-payout` | Admin/cron-only — pays a partner out after an event completes |
| `run-matching` | Admin/cron-only — groups confirmed bookings into matches |
| `auth-send-email` | Supabase Auth Hook — sends branded confirmation, recovery, invite, and security emails through Resend |
| `send-welcome-email` | Authenticated sign-in — sends one Resend welcome email after confirmation |
| `reveal-match` | Admin/cron-only — reveals matches + fires the reveal email |
| `resy-sniper` | Admin/cron-only — polls Resy for pending reservation slots |
| `send-booking-confirmation`, `send-match-revealed`, `send-feedback-request` | Internal — called by the functions above, never directly by clients |

**Admin-only functions require an `x-admin-secret` header** matching
`ADMIN_FUNCTION_SECRET` (see `.env.functions.example`) — there's no admin
role in `auth.users` yet, so this shared secret is what stands between
"any authenticated user" and "admin" for these endpoints. Whatever
dashboard/cron job calls them needs that header set; a plain diner/partner
JWT is rejected with 401.

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

## Testing & CI

- `npm test` runs the Vitest suite for pure client-side logic
  (`lib/mystery.ts`, `lib/sparks.ts`). Anything that touches Supabase/React
  Query directly isn't unit tested here — verify those by hand via the
  `run` skill or manual QA.
- `deno test supabase/functions` runs the matching-algorithm tests in
  `supabase/functions/run-matching/matching.test.ts`.
- `.github/workflows/ci.yml` runs `typecheck` + `lint` + `npm test` for the
  app, and `deno check` + `deno test` for the edge functions, on every PR.

Restaurant booking URLs, menus, parking details, and perks are intentionally
shown only when a restaurant partner has supplied real data. The app does not
invent or imply third-party offers.
