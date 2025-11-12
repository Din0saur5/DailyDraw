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
   export EXPO_PUBLIC_IAP_PRODUCT_ID="com.dailydraw.premium.monthly"
   ```
3. Run `npm start` and choose the platform target (`i`, `a`, or `w` in Expo CLI).
4. `npm run lint`, `npm run test`, and `npm run typecheck` are wired up for local validation before opening a PR.

## Environment variables

### Expo app (public / bundled)
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_ALLOW_DEV_AUTH_BYPASS` (optional, defaults to `true` during development)
- `EXPO_PUBLIC_IAP_PRODUCT_ID` (Apple product identifier for premium subscription)

### Supabase Edge functions
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME` (e.g., `dailydraw-originals`)
- `R2_PUBLIC_ENDPOINT` (or custom domain) if different from the default Cloudflare S3 endpoint
- `APPLE_IAP_SHARED_SECRET` (App Store shared secret for receipt validation)

### Render cleanup worker (cron)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

## Auth setup reference

DailyDraw uses Supabase email + password auth with password resets handled via Expo deep links. Use this checklist whenever you create a new Supabase project or rotate credentials.

### 1. Enable email/password auth
1. Supabase Dashboard → **Authentication → Providers**.
2. Toggle **Email** on and choose whether confirmations are required (recommended: enabled in production, disabled only for local dev).
3. Under **Authentication → URL Configuration**, set the **Site URL** to `dailydraw://auth/confirm` (or the matching Expo dev URL while testing). Then add both confirmation + reset URLs under **Additional Redirect URLs** so every environment can bounce back into the app:
   - `dailydraw://auth/confirm`
   - `dailydraw://reset-password`
   - `exp://127.0.0.1:8081/auth/confirm`
   - `exp://127.0.0.1:8081/reset-password`
   - `exp://192.168.1.174:8081/auth/confirm`
   - `exp://192.168.1.174:8081/reset-password`
   - `https://exp.host/@dinosaur5/DailyDraw?release-channel=default&scheme=dailydraw&path=auth/confirm`
   - `https://exp.host/@dinosaur5/DailyDraw?release-channel=default&scheme=dailydraw&path=reset-password`
   - Optional future web build: `https://daily-draw.app/auth/confirm` and `https://daily-draw.app/reset-password`

### 2. Configure SMTP
- **Production**: Provide real SMTP credentials (Resend, Postmark, Mailgun, etc.) under **Authentication → SMTP Settings**. Without this, Supabase will not send sign-up or password-reset emails.
- **Local/dev**: When you run `supabase start`, emails are logged in Studio/CLI so you can copy the links without SMTP.

Even with password-based login the forgot-password flow still emails users—SMTP is mandatory before launch.

### 3. Forgot-password flow
1. The “Forgot password?” CTA calls `supabase.auth.resetPasswordForEmail` with `Linking.createURL('/reset-password')` so dev, tunnel, and production builds all reuse the same path.
2. `SessionProvider` listens for the `PASSWORD_RECOVERY` event, automatically routes to `/reset-password`, and that screen calls `supabase.auth.updateUser({ password })`.
3. Email confirmations use `Linking.createURL('/auth/confirm')`; once Supabase verifies the token it redirects to that screen, which in turn navigates users back to sign in.
4. Test both confirmation and password-reset flows on the iOS simulator (localhost URL), a device on your LAN, and an Expo tunnel/release build before launch.
