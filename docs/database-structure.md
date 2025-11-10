# Database Structure

This note lists the core tables and important columns used by DailyDraw. Use it as a quick reference while working on Supabase migrations or debugging API interactions.

## `users`
- `id` (uuid) – relation to `auth.users.id`
- `username` (text)
- `email` (text)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- `apple_original_transaction_id` (text)
- `apple_app_account_token` (uuid)
- `apple_latest_transaction_id` (text)
- `apple_product_id` (text)
- `apple_environment` (text)
- `subscription_status` (`subscription_status` enum)
- `subscription_expires_at` (timestamptz)
- `will_renew` (bool)
- `is_in_grace_period` (bool)
- `is_in_billing_retry` (bool)
- `revoked_at` (timestamptz)
- `revocation_reason` (int2)
- `last_apple_notification_at` (timestamptz)
- `last_apple_notification_type` (text)

## `submissions`
- `id` (int8)
- `user_id` (uuid)
- `daily_prompt_id` (uuid)
- `caption` (text)
- `width` (int4)
- `height` (int4)
- `original_key` (text)
- `mime_type` (text)
- `is_removed` (bool)
- `created_at` (timestamptz)

## `reports`
- `id` (int8)
- `submission_id` (int8)
- `reporter_id` (uuid)
- `reason` (`report_reason` enum)
- `created_at` (timestamptz)

## `moderation_jobs`
- `id` (int8)
- `submission_id` (int8)
- `reason` (`report_reason` enum)
- `status` (`status` enum)
- `attempts` (int4)
- `last_attempt_at` (timestamptz)
- `created_at` (timestamptz)

## `daily_prompts`
- `id` (uuid)
- `prompt_date` (timestamptz)
- `difficulty` (`difficulty` enum)
- `prompt_text` (text)
- `prompt_bank_id` (int8)

## `prompt_bank`
- `id` (int8)
- `prompt_text` (text)
- `difficulty` (`difficulty` enum)
- `retired` (bool)
- `created_at` (timestamptz)
