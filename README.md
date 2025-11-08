# DailyDraw

Expo Router app for the DailyDraw mobile experience. The build spec lives in `docs/` and each PR slice is tracked in `docs/pr-roadmap.md`.

## Getting started

1. Install dependencies with `npm install`.
2. Copy `.env.example` (coming soon) or export the Expo env vars manually:
   ```bash
   export EXPO_PUBLIC_SUPABASE_URL="https://<project>.supabase.co"
   export EXPO_PUBLIC_SUPABASE_ANON_KEY="..."
   # optional — defaults to true in dev builds
   export EXPO_PUBLIC_ALLOW_DEV_AUTH_BYPASS=true
   ```
3. Run `npm start` and choose the platform target (`i`, `a`, or `w` in Expo CLI).
4. `npm run lint`, `npm run test`, and `npm run typecheck` are wired up for local validation before opening a PR.

## Environment variables

### Expo app (public / bundled)
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_ALLOW_DEV_AUTH_BYPASS` (optional, defaults to `true` during development)

### Supabase Edge functions
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME` (e.g., `dailydraw-originals`)
- `R2_PUBLIC_ENDPOINT` (or custom domain) if different from the default Cloudflare S3 endpoint

### Render cleanup worker (cron)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

## Auth setup reference

DailyDraw uses Supabase email + password auth with password resets handled via Expo deep links. Use this checklist whenever you create a new Supabase project or rotate credentials.

### 1. Enable email/password auth
1. Supabase Dashboard → **Authentication → Providers**.
2. Toggle **Email** on and choose whether confirmations are required (recommended: enabled in production, disabled only for local dev).
3. Under **Authentication → URL Configuration**, set your deployed web URL (placeholder: `https://daily-draw.app`) and add the Expo deep link (e.g., `dailydraw://auth/callback`) to Redirect URLs so password-reset magic links land back in the mobile app.

### 2. Configure SMTP
- **Production**: Provide real SMTP credentials (Resend, Postmark, Mailgun, etc.) under **Authentication → SMTP Settings**. Without this, Supabase will not send sign-up or password-reset emails.
- **Local/dev**: When you run `supabase start`, emails are logged in Studio/CLI so you can copy the links without SMTP.

Even with password-based login the forgot-password flow still emails users—SMTP is mandatory before launch.

### 3. Forgot-password flow
1. In-app “Forgot password?” calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'dailydraw://auth/reset' })`.
2. Listen for the `PASSWORD_RECOVERY` event inside the Auth Gate, show the “Set new password” screen, then call `supabase.auth.updateUser({ password: '...' })`.
3. Test the end-to-end flow on a real device with the Expo deep link before release.
