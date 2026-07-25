# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Task | Command |
|---|---|
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Test (all) | `npm test` |
| Test (single file) | `npx vitest run lib/mystery.test.ts` |
| Dev server | `npm start` |
| Web dev | `npm run web` |
| iOS dev | `npm run ios` |
| Web export | `npm run build:web` |
| Deno check (edge functions) | `for f in supabase/functions/*/index.ts; do deno check --config supabase/functions/deno.json "$f"; done` |
| Deno test (edge functions) | `deno test --config supabase/functions/deno.json supabase/functions` |

CI runs two parallel jobs: the app job (typecheck, lint, vitest) and the edge-functions job (deno check, deno test).

## Architecture

**Expo SDK 57 + React Native 0.86** app with **Supabase** backend. File-based routing via expo-router with typed routes. Styling via NativeWind v4 (Tailwind for React Native). Data layer is TanStack React Query v5 talking directly to the Supabase JS client.

### App layer (`app/`)

expo-router file-based routing. Route groups:
- `(auth)/` — magic-link login
- `(onboarding)/` — name → photo → food → personality → city
- `(tabs)/` — main app: home (tables), bookings, matches, club, profile
Auth gate in `_layout.tsx`: no session → `/intro`; session without `onboarded_at` → onboarding; onboarded → `/(tabs)/home`.

### Data layer (`lib/`)

- **`queries.ts`** (~1870 lines): all React Query hooks. `useQuery` for reads, `useMutation` for writes. Query keys follow `["entity"]` or `["entity", id]`. Mutations invalidate related keys in `onSuccess`. Several server-side RPCs for complex/secure queries (`get_upcoming_events`, `get_match_detail`, `get_event_attendees`, etc.).
- **`supabase.ts`**: Supabase client singleton + all TypeScript type definitions for database entities.
- **`auth.tsx`**: `AuthProvider` context, wraps the app inside `QueryClientProvider`. `signOut` clears the query cache.
- Pure logic in `mystery.ts`, `sparks.ts`, `matchValue.ts` — these are the only files with unit tests.

### Backend (`supabase/`)

**Edge functions** in `supabase/functions/`, each with an `index.ts`. Deno runtime, config in `supabase/functions/deno.json`. Shared utilities in `_shared/` (CORS headers, admin auth via `x-admin-secret` with timing-safe comparison).

Key function categories:
- **Payment**: `create-checkout-session`, `create-premium-checkout-session`, `stripe-webhook`
- **Matching pipeline**: `run-matching` (groups bookings into matches), `reveal-match` (reveals + emails), `resy-sniper` (books Resy reservations for `reservation` events)
- **Email**: `auth-send-email` (auth hook), `send-welcome-email`, `send-booking-confirmation`, `send-match-revealed`, `send-feedback-request` — all via Resend
- **Subscriptions**: `revenuecat-webhook`, `sync-revenuecat-premium` (iOS), Stripe webhook handles web subscriptions
- **Admin-only functions** require `ADMIN_FUNCTION_SECRET` header

**Migrations** in `supabase/migrations/`. Early ones numbered `0001`–`0022`, later ones use `YYYYMMDDHHMMSS_description.sql`. All tables use RLS. Key scoping patterns: users read/update own row, matches scoped to participants (`auth.uid() = any(user_ids)`).

### Resy integration

The app books real Resy reservations via `resy-sniper`. Events have a `resy_booking_status` (`pending` → `booked` | `failed`). The sniper polls Resy's `/4/find` API for availability, then books via `/3/details` + `/3/book`. The `reveal-match` function blocks reveals if `resy_booking_status` is `pending` or `failed`.

### Stripe flow

Diner pays via Checkout Session → `stripe-webhook` confirms booking on `checkout.session.completed` (validates amount/currency, auto-refunds mismatches, handles capacity rejections). Premium subscriptions managed via both Stripe (web) and RevenueCat (iOS).

## Key conventions

- **TypeScript strict mode**. Path alias `@/*` maps to repo root.
- **NativeWind className** for all styling. Theme colors: cream, pearl, gold, teal, ink, rust, clay, sage, muted, forest. Serif font: Georgia.
- **Event formats**: `dinner | brunch | lunch | late_night | food_crawl | chefs_table | picnic` (DB enum `event_format`).
- **Event types**: `reservation | catered` (DB enum `event_type`). Reservation events book via Resy; catered events are privately catered dinners/lunches/brunches/picnics at venues chosen by the app.
- **ESLint** extends `expo` preset. `supabase/functions/` is excluded (Deno, not Node). The `react-hooks/set-state-in-effect` rule is active — suppress with `eslint-disable-next-line` when initializing form state from async data.
- **Vitest** scoped to `lib/**/*.test.ts` only. Tests cover pure logic (mystery reveal, spark detection, match scoring), not hooks or components.
- **Edge functions** are Deno — use `https://esm.sh/` imports, not npm. The `deno.json` config sets `"lock": false`.
- Platform-split files use the `.native.ts` / `.web.ts` convention (see `lib/revenuecat.*`).

## Environment

Client env vars prefixed `EXPO_PUBLIC_`. Edge function env vars documented in `.env.functions.example`. Key vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ADMIN_FUNCTION_SECRET`, `RESY_API_KEY`, `RESY_AUTH_TOKEN`, `RESEND_API_KEY`.
