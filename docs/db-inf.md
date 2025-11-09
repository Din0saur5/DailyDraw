# DailyDraw Database Reference

This note distills the Supabase schema that already exists in the project so engineers can reason about data, RLS, and manual QA. Use it whenever you need a refresher on how the tables connect or when validating API behavior.

## 1. Tables at a glance

| Table / helper | Purpose | Key constraints & notes |
| --- | --- | --- |
| `public.users` | Profile rows created by the auth trigger. | `username` matches `^[A-Za-z0-9_.]{3,20}$`, case-insensitive unique index, premium metadata (`is_premium`, `premium_expires_at`). |
| `public.prompt_bank` | Source-of-truth prompt catalog. | `difficulty` enum (`very_easy`, `easy`, `medium`, `advanced`), `retired_at` set after a prompt is snapshotted. |
| `public.daily_prompts` | UTC snapshot per day + difficulty. | `prompt_date` is now a `timestamptz` pinned to UTC midnight; unique constraint enforced on `(date_trunc('day', prompt_date), difficulty)`; stores prompt text snapshot + pointer to `prompt_bank_id`. |
| `public.submissions` | One upload per user per prompt thread. | Unique `(daily_prompt_id, user_id)`, width/height > 0, caption ≤ 300 chars, boolean `is_removed`.|
| `public.reports` | Player moderation queue. | Unique `(submission_id, reporter_id, reason)` prevents spam; trigger flips `submissions.is_removed` after ≥10 matching reasons. |
| `public.moderation_jobs` | Background moderation follow-up (see diagram). | Tracks escalations kicked off by reports (status, attempts, timestamps). |
| `public.user_public` view | Safe profile fields for feed joins. | Grants `select` to `anon` + `authenticated`. |
| `public.user_is_premium(uid uuid)` | Helper for cleanup worker + policies. | Returns true when `is_premium` or `premium_expires_at > now()`. |

> The ERD in the issue description mirrors this structure: `users` connects to `submissions` via `user_id`, `submissions` connect to `daily_prompts`, and moderation tables (`reports`, `moderation_jobs`) hang off `submissions`.

## 2. Relationships & triggers

- **Auth trigger → users**: `auth.users` insert calls `public.handle_auth_user_created()` to seed profile rows and generate fallback usernames.
- **Prompt lifecycle**: inserting into `daily_prompts` copies difficulty/text, then `retire_prompt_bank_after_snapshot` stamps `prompt_bank.retired_at` so seeds do not repeat prematurely.
- **Reporting flow**: `reports_flag_submission` checks `reports` counts per `(submission_id, reason)`; once the count reaches 10, it flips `submissions.is_removed` and records `removed_reason`.
- **Touch triggers**: `touch_updated_at` runs on each mutable table so `updated_at` stays in sync without client awareness.

## 3. RLS quick reference

| Table | Select | Insert | Update |
| --- | --- | --- | --- |
| `users` | `auth.uid() = id` | — | `auth.uid() = id` |
| `prompt_bank` | any authenticated | — | — |
| `daily_prompts` | any authenticated | — | — |
| `submissions` | (1) owner rows via `auth.uid() = user_id`; **and** (2) globally visible when `is_removed=false` | only when `user_id = auth.uid()` | same as insert (owner only) |
| `reports` | reporter can read their rows | `reporter_id = auth.uid()` **and** not targeting own submission | — |
| `user_public` view | `anon` + `authenticated` for username lookups | n/a | n/a |

Remember: PostgREST requests must include a valid user JWT to pass these checks even for “public” data, except for the `user_public` view or functions invoked by the service key (Edge functions, worker, etc.).

## 4. Manual SQL spot checks

Paste these into the Supabase SQL editor or run via `psql "$SUPABASE_CONNECTION_STRING"` when validating deployments.

```sql
-- A. Confirm four snapshots per UTC day (one per difficulty)
select date_trunc('day', prompt_date) as prompt_day,
       count(*) as total,
       string_agg(difficulty::text, ', ' order by difficulty) as difficulties
from public.daily_prompts
where prompt_date >= timezone('utc', now()) - interval '3 day'
group by prompt_day
order by prompt_day desc;

-- B. Snapshot integrity: every daily_prompt points at prompt_bank
select dp.id,
       date_trunc('day', dp.prompt_date) as prompt_day,
       dp.prompt_date as prompt_timestamp,
       dp.difficulty,
       left(dp.prompt_text, 80) as sample_text,
       pb.retired_at is not null as retired
from public.daily_prompts dp
join public.prompt_bank pb on pb.id = dp.prompt_bank_id
order by prompt_day desc, dp.difficulty;

-- C. Enforce one submission per user per thread (should return zero rows)
select daily_prompt_id,
       user_id,
       count(*)
from public.submissions
group by daily_prompt_id, user_id
having count(*) > 1;

-- D. Recent submissions + moderation flag
select s.id,
       date_trunc('day', dp.prompt_date) as prompt_day,
       dp.prompt_date as prompt_timestamp,
       dp.difficulty,
       s.user_id,
       s.is_removed,
       s.removed_reason,
       s.created_at
from public.submissions s
join public.daily_prompts dp on dp.id = s.daily_prompt_id
order by s.created_at desc
limit 20;

-- E. Reports threshold check (see which rows crossed the 10-report mark)
with reason_counts as (
  select submission_id, reason, count(*) as reports
  from public.reports
  group by submission_id, reason
)
select rc.submission_id,
       rc.reason,
       rc.reports,
       sub.is_removed
from reason_counts rc
join public.submissions sub on sub.id = rc.submission_id
order by rc.reports desc
limit 10;
```

## 5. RLS validation ideas

- **Users** – run `set role authenticated; set request.jwt.claim.sub = '<user uuid>'; select * from public.users;` and confirm only that row appears. Attempting `update public.users set bio='x' where id != auth.uid()` should fail.
- **Submissions** – with another user’s JWT claims, `select id from public.submissions where user_id = '<other>' and is_removed = false;` should return 0 rows (unless viewing via a feed-specific RPC/view that enforces visibility). Inserting with `user_id != auth.uid()` raises `42501`.
- **Reports** – try inserting `reporter_id = (select user_id from submissions where id = '<submission>' )` to verify the policy rejects self-reporting.

Supabase CLI (`supabase gen jwt --no-claims`) plus manual claim injection works for local testing.

## 6. PostgREST smoke tests

```bash
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_ANON_KEY="<anon key>"
export AUTH_BEARER="<user access token>"
export AUTH_USER_ID="<same user uuid>"

# Today’s prompt snapshots (UTC window – prompt_date is timestamptz)
curl "$SUPABASE_URL/rest/v1/daily_prompts?select=prompt_date,difficulty,prompt_text&prompt_date=gte.<today_midnight_utc>&prompt_date=lt.<tomorrow_midnight_utc>" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $AUTH_BEARER"

# Fetch profile row via RLS-protected table
curl "$SUPABASE_URL/rest/v1/users?id=eq.$AUTH_USER_ID" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $AUTH_BEARER"

# Create or upsert a submission (unique per thread)
curl "$SUPABASE_URL/rest/v1/submissions" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $AUTH_BEARER" \
  -H "Content-Type: application/json" \
  -d '{
        "daily_prompt_id": "<prompt uuid>",
        "user_id": "'$AUTH_USER_ID'",
        "caption": "Testing upload",
        "original_key": "orig/'$AUTH_USER_ID'/'$(date -u +%F)'/<uuid>.jpg",
        "mime_type": "image/jpeg",
        "width": 1024,
        "height": 1024
      }'
```

Replace `<today_midnight_utc>` / `<tomorrow_midnight_utc>` with ISO timestamps like `2025-02-15T00:00:00Z`. On macOS you can export them via `TODAY_UTC=$(date -u +%Y-%m-%dT00:00:00Z)` and `TOMORROW_UTC=$(date -u -v+1d +%Y-%m-%dT00:00:00Z)`; on GNU `date`, use `-d 'tomorrow'` instead of `-v+1d`.

Expected outcomes:
- `201 Created` on first insert, `409 Conflict` when the unique constraint fires, `401/403` when JWT/claims are missing.

## 7. Prompt seed cross-check

`docs/prompt_seed.csv` lists the canonical starter prompts. To confirm they exist in the DB:

```sql
select pb.prompt_text,
       pb.difficulty,
       coalesce(pb.retired_at, 'active') as retired_flag
from public.prompt_bank pb
order by pb.created_at asc
limit 25;
```

Missing entries can be bulk inserted via the Supabase SQL editor or `COPY ... FROM STDIN` with the CSV, but for PR2 we only document/verify—that keeps production data untouched.

## 8. Useful metadata for future work

- **Cleanup worker** relies on `user_is_premium` when deleting submissions older than `timezone('UTC', now())::date` (see Build Spec §11).
- **Edge functions** consume this schema exactly as described in Build Spec §7; the `/feed` function joins `submissions` to `user_public` so it never leaks private columns.
- **Moderation jobs** tie into the future automation pipeline (Render worker or Supabase cron). Even though PR2 doesn’t modify them, understanding the foreign key to `submissions` helps when triaging report escalations.

Keep this file handy whenever you need to reference constraints or craft manual QA queries—no Supabase migrations required.
