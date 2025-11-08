# DailyDraw Auth Setup

This project now relies on Supabase’s email + password auth flow (instead of magic links). Use the checklist below whenever you stand up a new Supabase project or refresh credentials.

## 1. Enable email/password auth
1. Open the Supabase Dashboard → **Authentication → Providers**.
2. Toggle **Email** on and ensure “Enable email confirmations” is set to whichever behavior you expect (recommended: keep it on for production, off only for local dev).
3. Under **Authentication → URL Configuration**, set the **Site URL** to your deployed web URL (placeholder: `https://daily-draw.app`) and add the Expo deep link (e.g., `dailydraw://auth/callback`) to **Redirect URLs** so password-reset links can route back into the mobile app.

## 2. Configure SMTP
- **Production**: Provide real SMTP credentials (Resend, Postmark, Mailgun, etc.) under **Authentication → SMTP Settings**. Supabase will not deliver signup confirmations or password resets without a working SMTP transporter.
- **Local/dev**: When you run `supabase start`, emails are logged to the Studio & CLI console, so you can copy the links without setting up SMTP.

Even though password-based login removes the need for daily magic-link email churn, the forgot-password flow still emails users—so SMTP remains required before launch.

## 3. Forgot-password flow
1. In-app “Forgot password?” calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'dailydraw://auth/reset' })`.
2. Handle the `PASSWORD_RECOVERY` event in your Auth Gate to show the “Set new password” screen and call `supabase.auth.updateUser({ password: '...' })`.
3. Test the entire path using a real device + Expo deep link before release.

## 4. Environment variables
- Mobile app: `.env` / Expo config needs `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Edge functions / workers: supply `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and storage credentials in their respective hosting environments.

Keep this README co-located with the build spec so future contributors know how to provision auth without digging through dashboard screenshots.
