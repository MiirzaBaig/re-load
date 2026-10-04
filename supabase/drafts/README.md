# Unapplied migration drafts

Kept for reference; **not** in `supabase/migrations/`, so `supabase db push`
will not apply them.

- `202610040002_bootstrap_team_admin.sql` — auto-grants owner access to whoever
  confirms the `admin@reload.sa` mailbox. Parked: there is no `@reload.sa`
  mailbox yet, and the admin account was granted directly instead. Revisit
  when moving to personal admin accounts.
