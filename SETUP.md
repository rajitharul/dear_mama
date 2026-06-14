# DearMama — Setup

A React Native (Expo) pregnancy onboarding app. Data is stored in **Supabase** (Postgres + email/password auth), with a local cache for offline/instant render.

## 1. Configure Supabase

`.env` already holds your project URL + anon (publishable) key:

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

## 2. Reset the database & create the schema

In the Supabase dashboard → **SQL Editor → New query**, paste and run the migrations in
[`supabase/migrations/`](supabase/migrations/) **in order**:

1. [`0001_reset_and_onboarding.sql`](supabase/migrations/0001_reset_and_onboarding.sql) — drops the
   old tables (pregnancies, profiles, events, etc.) and creates the normalized `profiles` table
   (one row per user) with Row Level Security so each user only sees their own data.
2. [`0002_physical_baseline.sql`](supabase/migrations/0002_physical_baseline.sql) — adds the richer
   physical-baseline columns (`rh_factor`, `pre_pregnancy_weight`, `height`, `obstetric_history`,
   `lifestyle_flags`). **Required for onboarding to save** — without it "Create my journey" fails.
3. [`0003_care_logs.sql`](supabase/migrations/0003_care_logs.sql) — adds the Care tab's logging tables.

Run all three; the app writes columns/tables from every migration.

## 3. Enable email + password auth

- **Authentication → Providers → Email**: make sure Email is enabled.
- For the smoothest local dev, turn **off** "Confirm email" so sign-up logs you straight in.
  (If you leave it on, click the confirmation link in your email before signing in.)

## 4. Run

```bash
npm install
npx expo start -c
```

## Flow

1. **Sign in / Create account** (email + password).
2. **Onboarding wizard** — Profile → Pregnancy (due-date/last-period, doctor-vs-self source,
   how many babies) → Medical (optional) → Contacts & care team (optional) → Review.
3. **Create my journey** → saves your `profiles` row in Supabase → **Home** summary with the
   week countdown. "Edit details" reopens the wizard prefilled; "Sign out" returns to sign-in.

## Notes
- Reads/writes are bounded by timeouts; if the server is unreachable the app shows a **Try again**
  screen (or falls back to the cached profile) — it never spins forever.
- Fonts load non-blocking; the app renders immediately with system-font fallback.
- Onboarding/SignIn illustrations live in `assets/images/onboarding/`. Regenerate them with
  `node scripts/gen-images.mjs` (uses `OPENAI_API_KEY` from `.env`).
