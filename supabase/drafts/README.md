# Unapplied migration drafts

Reviewed 2026-10-13. Files here are intentionally outside `supabase/migrations/`; `supabase db push` does not apply them.

`202610040002_bootstrap_team_admin.sql` is historical auto-bootstrap code for the shared admin email. Do not apply it to enable staff accounts: personal team invitations, verified-email claim and staff roles already exist. An existing Reload owner invites a teammate through Admin → Team; the teammate signs in with that exact email. Merchant approval remains unchanged.
