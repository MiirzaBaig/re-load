# Merchant and team sign-in email delivery

Reviewed 2026-10-13 against code and available inventory. Hosted SMTP values below are the 11 October recorded configuration, not freshly exported settings.

Supabase Auth sends login links and codes using Resend SMTP. This is separate from WhatsApp order verification, which calls the Resend HTTP API from the Edge worker.

## Live configuration (11 October 2026)

- Project: `clwczcvxosudfevjznmk`
- Custom SMTP enabled
- Host: `smtp.resend.com`, port `465`
- Username: `resend`
- Sender: `Reload <no-reply@notify.reload.sa>`
- Password: the Resend API key, saved in hosted Auth settings only
- Auth email limit: 30 per hour across the project
- Existing one-minute resend interval and eight-digit Auth codes preserved
- Google sign-in, MFA and redirect allowlist preserved

The default Supabase sender was disabled; its project-wide sending limit was blocking subsequent login requests. A real Auth sign-in request to the approved team test inbox returned HTTP 200 after configuring SMTP. Provider acceptance does not prove inbox delivery or successful completion of login.

Both sign-in interfaces now guard against overlapping email submissions, handle network failures, impose a retry cooldown on rate errors and distinguish sending limits from other failures. The UI cooldown does not override server limits.

For diagnosis, check Supabase Auth logs and Resend delivery logs. If the limit is reached, check existing inbox links before retrying. Increase the configured limit only alongside the Resend plan allowance and usage requirements. Do not disable authentication rate limits.

SMTP changes were applied through a temporary, narrowly scoped CLI configuration. SMTP credentials are not stored in Git or frontend environment variables. Existing order verification credentials and behavior remain unchanged.

References:
- https://supabase.com/docs/guides/auth/auth-smtp
- https://resend.com/docs/send-with-supabase-smtp

## Personal staff access

An existing owner adds the teammate's exact email and role in Admin → Team. The teammate opens /admin/login and confirms their personal email; /admin claims the pending invitation. Saving an invitation does not itself send an invitation email. The shared admin password route remains as a legacy fallback. Current staff MFA enforcement is temporarily disabled (`ADMIN_REQUIRE_MFA=false` plus the database policy); do not describe MFA as required today.
