# DailyDraw PR Roadmap

This checklist breaks the build spec into bite-sized, reviewable pull requests. Each PR should ship completed UI, tests, and docs updates before moving to the next slice.

## PR 1 – Project Bootstrap & Tooling
- Initialize Expo Router project with TypeScript, ESLint/Prettier, Jest.
- Add `app/_layout.tsx` shell with providers, TanStack Query client, and placeholder screens.
- Wire `.env` handling (`EXPO_PUBLIC_SUPABASE_URL`, etc.) and document setup in `README.md`.

## PR 2 – Supabase Schema & Seeds
- Observe existing tables `users`, `prompt_bank`, `daily_prompts`, `submissions`, `reports`, helper functions, and RLS from the build spec.
- Add basic “manual QA” query snippets (e.g., `select * from daily_prompts`) to confirm schema deploys cleanly, and capture them in `docs/db-inf.md`. Add tests to make sure the API is functioning properly

## PR 3 – Edge Function Skeletons
- Scaffold the six core Deno functions (`/username/set`, `/uploads/sign`, `/submissions/create`, `/images/sign-get`, `/prompts/today`, `/feed`, `/reports`) with type-safe request parsing and shared error helpers.
- Add unit tests or integration stubs for each function’s happy-path + validation failures.
- Document env requirements (service key, R2 credentials) near each function.

## PR 4 – Auth Gate + Password Flow
- Implement the password-based auth screen with sign-in/sign-up tabs, inline validation, and `Forgot Password` deep link handling.
- Connect Supabase client session persistence + Zustand store, ensuring bypass logic works only for local dev.
- Add README instructions for testing password recovery on device.

## PR 5 – Prompts Home (“Today’s Four”)
- Build `app/index.tsx` to fetch `/prompts/today`, render four cards (grouped by difficulty tiers), and show pessimistic loading/error states.
- Add TanStack Query hooks for prompts and countdown helpers.
- Instrument analytics/logging hooks (even if no-op) to keep structure ready.

## PR 6 – Thread Screen Upload Flow
- Implement `app/t/[date]/[difficulty].tsx` with prompt details, upload sheet, caption validation, and call to `/uploads/sign` + PUT to R2.
- Persist upload state in `useUploadStore`, showing retries for flaky connections.
- Add mutations/tests for `/submissions/create` and confirm conflict-upsert behavior is surfaced in UI.

## PR 7 – Feed Rendering & Reporting
- Build `FeedList` with infinite scroll, signed GET fetching per item, placeholder states, and pessimistic refresh logic.
- Hook up the report sheet to `/reports`, removing items optimistically but refetching after server confirmation.
- Add empty state for zero submissions and highlight when a user’s own upload is shown first.

## PR 8 – Library & Premium Gating
- Implement `app/library.tsx` split view: premium users see paginated history, free users get upsell copy tied to Apple IAP CTA.
- Integrate React Native IAP (Apple only) to flip `user_is_premium`, update Supabase profile, and handle restore purchases.
- Ensure background cleanup respects the premium flag; write manual QA steps to simulate downgrade + cleanup.

## PR 9 – Settings & Username Management
- Flesh out `app/settings.tsx` with profile display, change-username form calling `/username/set`, and logout CTA.
- Add debug tools (e.g., show current prompt date, user ID) guarded behind dev builds.
- Extend tests covering username validation + edge cases (conflicts, invalid regex).

## PR 10 – Background Worker & Ops
- Port the cleanup worker to a Render-friendly Node script, parameterized via env vars.
- Add batching + retry logic exactly as outlined in the spec, plus logging hooks to Supabase `logs` (if enabled).
- Document deployment steps and cron scheduling in `README.md`.

## PR 11 – Polish, QA, and Launch Readiness
- Run through full UTC day rollover tests, verify RLS rules with authenticated/unauthenticated clients, and capture results.
- Add crash/error monitoring setup (Sentry or placeholder) and ensure Supabase/Edge logs include useful metadata.
- Review analytics hooks, finalize copy, and file any remaining backlog items (prompt seeding automation, Android billing roadmap).

## PR 12 – StoreKit QA & Release Prep
- Stand up a TestFlight build that includes the StoreKit integration and confirm purchases succeed end-to-end with a sandbox tester.
- Document, in `README.md`, the exact steps for creating sandbox accounts, installing the build, triggering purchases/restores, and verifying premium state in Supabase.
- Capture verification notes (logs, screenshots, timestamps) so the App Store review packet can cite successful sandbox runs.
- Ensure the release checklist covers promoting the same build to production once QA is complete.
