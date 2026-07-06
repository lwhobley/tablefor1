# Table for 2 App Store Connect Submission

## Bundle

- Display name: Table for 2
- Bundle ID: `com.tablefor2.app`
- SKU suggestion: `tablefor2-ios`
- Primary language: English (U.S.)
- Category: Food & Drink
- Age rating: 12+ recommended because the app coordinates real-world dining with other people.

## Before Running The Build

1. Create the App Store Connect app record with bundle ID `com.tablefor2.app`.
2. Add a privacy policy URL and support URL in App Store Connect.
3. Confirm `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_AUTH_REDIRECT_URL` are set in the EAS production environment.
4. Add `tablefor2://` and the production auth callback URL to Supabase Auth redirect URLs.
5. Configure Apple credentials with `npx eas-cli@latest credentials -p ios`.
6. Run `npx eas-cli@latest build -p ios --profile production --submit` to build and submit to TestFlight/App Store Connect.

## Review Notes Template

Table for 2 helps diners book curated restaurant dinners and meet matched table companions. Reviewers can create an account with email/password in the app. If a preloaded demo account is preferred, create one in Supabase before submission and add the credentials here.

Premium and booking payments use Stripe Checkout. Camera/photo access is used only for profile photos, dinner story photos, chat photos, and check-in selfies.
