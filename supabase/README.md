# Supabase setup

The repository now contains the authentication client and the first tenant-safe MVP schema. The live Supabase project still needs to be created and connected.

## Create and connect the project

1. Create a Supabase organization and project for Reload. Use the shared company email for ownership, then invite each teammate with their own account. Do not share the Gmail password.
2. In the Supabase dashboard, open **Connect** and copy the Project URL and Publishable key.
3. Copy `.env.example` to `.env.local` and add those two values. The publishable key is designed for browser use; never put a `service_role` or secret key in a `NEXT_PUBLIC_` variable.
4. Apply `supabase/migrations/202609180001_initial_mvp.sql` in the SQL Editor. Run it before creating the first user so the signup trigger can create their store and owner membership.
5. Under **Authentication → URL Configuration**, set the production Site URL and add both redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR-VERCEL-DOMAIN/auth/callback`
6. Keep Email + Password enabled. For production, keep email confirmation enabled and configure a branded SMTP sender before inviting merchants.

## Enable Google sign-in

1. In Google Auth Platform, add `https://clwczcvxosudfevjznmk.supabase.co/auth/v1/callback` as an authorized redirect URI.
2. In Supabase, open **Authentication → Sign In / Providers → Google**, enable it, and enter the Google Client ID and a newly rotated Client Secret.
3. In Supabase **Authentication → URL Configuration**, add the local and production application redirect URLs.
4. Set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` locally and in Vercel after the provider is enabled.

The Google Client Secret belongs only in the Supabase provider settings. Never put it in `.env.local`, frontend source, or a `NEXT_PUBLIC_` variable.

Restart `npm run dev` after adding `.env.local`. Create the first account from `/auth`; its store name becomes the first store workspace.

## Current boundary

Supabase now owns real merchant identity, sessions, store membership, store settings, and row-level tenant isolation. The existing policy, decision, case, and customer screens still use demo fixtures/local storage until their service layer is moved to trusted server functions. Published policy versions, decisions, cases, and audit events are intentionally read-only to browser clients; trusted server code must create that evidence.

## Salla connection

Apply migrations `202609180002_channels_and_integrations.sql` and `202609180003_salla_server_functions.sql` in order. Then configure these Edge Function secrets in **Project Settings → Edge Functions → Secrets**:

- `SALLA_CLIENT_ID`
- `SALLA_CLIENT_SECRET`
- `SALLA_WEBHOOK_SECRET`
- `SALLA_REDIRECT_URI=https://clwczcvxosudfevjznmk.supabase.co/functions/v1/salla-oauth-callback`
- `APP_URL=https://mujeb-cpu-mujeb.vercel.app`
- `INTEGRATION_ENCRYPTION_KEY` with 32 random bytes encoded as base64

Deploy `salla-oauth-start`, `salla-oauth-callback`, `salla-connection`, and `salla-webhook`. In Salla Partners choose **Custom Mode** while testing, request only `orders.read`, and enter:

- Callback URL: `https://clwczcvxosudfevjznmk.supabase.co/functions/v1/salla-oauth-callback`
- Webhook URL: `https://clwczcvxosudfevjznmk.supabase.co/functions/v1/salla-webhook`

The webhook uses Salla's Signature strategy. Its secret must match `SALLA_WEBHOOK_SECRET`. Move to Easy Mode only when the app is ready for Salla App Store publishing.

## Magic-link email

In **Authentication → Email Templates → Magic Link**, use subject `Your secure sign-in link to Reload` and paste the contents of `supabase/templates/magic-link.html`. The template intentionally uses `{{ .ConfirmationURL }}` so Supabase sends a magic link rather than an OTP code. Disable click tracking in the SMTP provider because rewritten authentication links can fail. The app sends users back to `/app`, so every local and production origin used by the app must be present in the Supabase redirect allow list.
