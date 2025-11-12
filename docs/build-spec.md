# DailyDraw Build Spec

## 1. Product Overview
- **App goal**: Encourage daily art practice by surfacing four difficulty-tiered prompts per day and hosting a moderated feed for user submissions.
- **Platforms**: iOS + Android (Expo-managed React Native).
- **Key pillar**: Every thread (prompt + difficulty + day) allows exactly one original upload per user. Premium users retain their archive; free users reset daily.
- **Operational window**: “Day” defined on UTC. Cleanup cron runs 05:05 UTC to clear non-premium history.
- **Out of scope (v1)**: Social graph, reactions, comments, payments, AI/watermark detection, offline mode.

## 2. High-Level Architecture
- **Clients**: Expo Router app with TypeScript, TanStack Query for server interactions, Zustand for transient UI state.
- **Auth & Data**: Supabase Auth + Postgres with RLS policies. Supabase Edge Functions (Deno) front load-bearing workflows requiring secrets or denser logic.
- **Storage**: Cloudflare R2 bucket for original assets. Files are private; access is through short-lived signed URLs from Edge.
- **Background**: Render-hosted Node worker executes scheduled cleanup (05:05 UTC) to delete non-premium assets + DB rows.
- **Monitoring**: Expo error boundary, Supabase logs, Render cron logs (stretch goal to capture to Supabase `logs` table).

```
┌─────────────────────┐       ┌──────────────────────┐
│     Expo Client     │◀─────▶│ Supabase JS Client   │
│  (TanStack Query)   │       │   (Auth + SQL)       │
└────────┬────────────┘       └────────┬─────────────┘
         │                               │
         ▼                               ▼
┌─────────────────────┐       ┌──────────────────────┐
│ Supabase Edge (Deno)│       │ Postgres + RLS       │
│ - uploads/sign      │       │ - prompts            │
│ - submissions/create│       │ - submissions        │
│ - images/sign-get   │       │ - reports            │
│ - username/set      │       │ - funcs/helpers      │
└────────┬────────────┘       └────────┬─────────────┘
         │                               │
         ▼                               ▼
    Cloudflare R2                  Render cron worker
```

## 3. App Modules & Routing
- **Expo Router file map**
  - `app/_layout.tsx`: Auth gate, global providers, route guards.
  - `app/index.tsx`: Today’s Four screen.
  - `app/t/[date]/[difficulty].tsx`: Prompt thread view (upload + feed).
  - `app/library.tsx`: Historical submissions (premium only) or upsell.
  - `app/settings.tsx`: Username update, logout, debug.
- **Navigation stack**
  - Root layout uses `<Stack>` with tabs optional (future). For v1 rely on stack screens.
  - Each screen fetches data via TanStack Query hooks from `lib/queries`.

## 4. State Management
- **TanStack Query**
  - Query keys: `['prompts', 'today']`, `['prompt', date, difficulty]`, `['feed', dailyPromptId]`, `['library']`, `['profile']`.
  - Mutations: `useSetUsername`, `useUploadSubmission`, `useReportSubmission`.
  - Query client configured in `_layout.tsx`, rehydrate on session changes.
- **Zustand**
  - `useSessionStore`: current user profile + loading state.
  - `useUploadStore`: pending asset metadata, local UI flags (sheet open, selected file).
  - Avoid storing server data in Zustand; keep it UI-only.

## 5. Key Libraries & Setup
- Install with Expo-managed CLI:
  - `expo install expo-router expo-image-picker expo-image-manipulator expo-file-system`
  - `npm i @tanstack/react-query zustand @supabase/supabase-js`
- Configure TypeScript paths via `tsconfig.json`.
- `app.config.ts` reads ENV vars (prefixed with `EXPO_PUBLIC_`).
- Provide `metro.config.js` if needed for asset plugin defaults.

## 6. Supabase Schema Summary
- `public.users`: canonical profile (enforced by auth trigger). `username` unique; maintain subscription metadata.
- `public.prompt_bank`: seeded prompts; reused until retired.
- `public.daily_prompts`: snapshot table keyed by `prompt_date+difficulty`. Trigger retires prompt when used.
- `public.submissions`: row per user per prompt thread (bigint `id`, foreign keys to `users.id` + `daily_prompts.id`). `original_key` stored for R2 path.
- `public.reports`: unique per `(submission_id, reporter_id, reason)` with trigger to set `is_removed` after ≥10 identical reason reports. `submission_id` is the bigint from `public.submissions.id`.
- Helper function `user_is_premium(uid uuid) returns boolean`.
- RLS quick reference:
  - Users: `auth.uid() = id` for full row; view `user_public` for listing.
  - Prompts: `authenticated` can select.
  - Submissions: `auth.uid() = user_id` for insert/update/select; `authenticated` can select `is_removed = false` via policy or view.
  - Reports: `authenticated` can insert when `auth.uid() != target.user_id`.

## 7. Edge Function Contracts (Deno)
| Route | Method | Request | Response | Notes |
|-------|--------|---------|----------|-------|
| `/username/set` | POST | `{ username }` | `{ username }` | Validates regex (`^[A-Za-z0-9_.]{3,20}$`), checks availability, updates profile. |
| `/uploads/sign` | POST | `{ ext: 'jpg'|'png', size }` | `{ putUrl, key, mime }` | Reject >10 MB, create key `orig/{userId}/{promptDate}/{uuid}.{ext}`. |
| `/submissions/create` | POST | `{ dailyPromptId, key, caption, width, height }` | `Submission` | Uses `insert ... on conflict (user_id, daily_prompt_id) do update set ... returning *`. |
| `/images/sign-get` | GET | `?key=...` | `{ url, expiresAt }` | Validates ownership for library; otherwise ensures `is_removed = false`. |
| `/prompts/today` | GET | none | `DailyPrompt[]` | Checks `timezone('UTC', now())::date`. |
| `/feed` | GET | `?dailyPromptId=&cursor=&limit=` | `SubmissionWithUser[]` | Joins `public.users.username`, filters `is_removed=false`. `cursor` uses `created_at` ISO timestamps; `limit` ≤50 (default 20). |
| `/reports` | POST | `{ submissionId, reason }` | `204` | `submissionId` is the bigint submission ID (send as decimal string). Trigger flips `is_removed` after threshold. |
| `/premium/set` | POST | `{ isPremium, receiptData, productId, transactionId }` | `{ isPremium, productId, expiresAt }` | Verifies Apple StoreKit receipt (requires `APPLE_IAP_SHARED_SECRET`) and updates `users.is_premium`. |

Implementation notes:
- Edge functions rely on `createClient` with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. Validate `supabase.auth.getUser()` on each request.
- Receipt verification function additionally requires `APPLE_IAP_SHARED_SECRET` to call Apple’s `/verifyReceipt` API.
- Provide shared util module for error responses (HTTP 400/401/409).
- Wrap R2 signing using AWS SDK (S3 compatible) or `cloudflare` package; keep TTL ≤5 minutes.

## 8. Client Data Fetching
- `lib/supabase.ts`: create Expo-specific Supabase client, use `startAutoRefresh`, persist session (AsyncStorage).
- `lib/edge.ts`: thin wrapper using `fetch` + auth header from Supabase session.
- `lib/uploads.ts`: orchestrates call to `/uploads/sign`, `fetch` PUT to `putUrl`, handles retries/backoff, returns final key.
- `lib/dates.ts` helpers:
  - `utcToday(): string` → `YYYY-MM-DD` using `Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' })`.
  - `countDownToUtcMidnight(): number` returns ms for countdown display.

## 9. Screen Specifications
- **Auth Gate**
  - On app load, check Supabase session.
  - If session missing → show password-based auth screen (two tabs: Sign In and Create Account) backed by Supabase email+password auth (`supabase.auth.signInWithPassword` / `supabase.auth.signUp`).
  - Auth screen requirements:
    - Email + password fields, inline validation (email format, password ≥8 chars, matching confirm input on signup).
    - “Forgot password?” path that triggers `supabase.auth.resetPasswordForEmail` and deep-links back into the app for the `PASSWORD_RECOVERY` event (details in `README.md` Supabase setup section).
    - For dev/testing, allow bypass when running against Supabase local/studio; production builds must hide it.
  - Once authenticated, fetch `user_public` row; if `username` matches placeholder regex (`user_<uuid>`), redirect to UsernamePick.
- **Today’s Four (`app/index.tsx`)**
  - Query `/prompts/today`.
  - Render grid/list of 4 cards using `PromptCards` component. Card shows difficulty badge, truncated prompt text, CTA.
  - On press navigate to `t/[date]/[difficulty]`.
- **Thread Screen**
  - Params: `date`, `difficulty`.
  - On mount, fetch `daily_prompt` row (via `GET /prompts/today` cache or dedicated call).
  - Query `['submission', dailyPromptId, userId]` to know if user uploaded.
  - If none → show `UploadSheet` entry point with instructions and `Pick image` button.
  - Upload flow collects caption (≤300 chars). After mutation success, invalidate `['feed', dailyPromptId]`.
  - `FeedList`: infinite scroll (page size 20). Each feed item fetches signed GET URL on render; cache URL per submission for TTL.
  - Report button opens `ReportSheet` (reason radio). On submit call `/reports`, optimistically remove card.
- **Library**
  - Fetch `user_is_premium` (via profile). If true, paginate all submissions for user (ordered desc, grouped by date). Use signed GETs.
  - Non-premium: show zero-state with CTA to upgrade (copy only, no purchase flow).
- **Settings**
  - Display username, subscription status, `Change Username` form (calls `/username/set`).
  - `Logout` button clears Supabase session.

## 10. Media Handling
- Use `expo-image-picker` with `allowsMultipleSelection=false`, `quality=1`, request camera roll permission inline.
- `expo-image-manipulator` pipeline:
  - Resize longest side ≤2048 px.
  - Convert to JPEG (or preserve PNG if chosen) without EXIF.
  - Capture final `width/height` for DB.
- For uploads:
  - Use `fetch(putUrl, { method: 'PUT', headers: { 'Content-Type': mime }, body: file })`.
  - On failure with 403, re-request signature.
  - Display progress indicator (optional, using `XMLHttpRequest` or background upload – backlog item).

## 11. Background Cleanup Worker (Render Cron)
- Node script runs daily at 05:05 UTC.
- Steps:
  1. Create Supabase service client with service role key.
  2. Query non-premium submissions prior to current UTC date:
     ```sql
     select s.id, s.original_key
     from public.submissions s
     join public.daily_prompts d on d.id = s.daily_prompt_id
     where d.prompt_date < (timezone('UTC', now())::date)
       and not user_is_premium(s.user_id)
     limit 1000;
     ```
  3. Batch delete from R2 via S3 API (`DeleteObjects`).
  4. Delete rows matching IDs.
  5. Loop until no rows; log metrics.
- Worker should be idempotent and resilient to partial failures (retry on R2 errors, skip missing keys).

## 12. Security & Compliance
- Enforce validation on client & Edge for captions (≤300 chars), file size ≤10 MB.
- Ensure app does not accept watermarked/AI detection yet; rely on report system.
- Protect signed URLs with short TTL (≤5 min) and limit GET signing to rows where `is_removed=false` (or owned by user for library).
- Use Expo secure storage for session tokens.
- Include crash logging (Sentry optional).

## 13. Analytics & Telemetry (Optional)
- Hook into Expo Router navigation events to send screen views (Segment or Supabase `analytics` table).
- Capture upload success/fail, report submissions, cleanup stats.

## 14. Implementation Roadmap
1. **Project bootstrap**
   - Expo project init, TypeScript setup, env wiring, provider scaffolding.
2. **Auth + Supabase client**
   - Session persistence, username gate.
3. **Prompts & Home screen**
   - Query wiring, `PromptCards` component.
4. **Thread flow**
   - Upload pipeline, feed rendering, reporting.
5. **Library & Settings**
   - Premium gating, username change UI.
6. **Edge functions**
   - Implement contracts, add integration tests (Deno) where possible.
7. **Background worker**
   - Port cleanup script, schedule on Render.
8. **QA & polish**
   - Test across OSes, run through daily cutoff, confirm RLS paths.
