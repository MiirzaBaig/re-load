-- Team desk: login only, no second factor (temporary, at the team's request).
--
-- Every staff RLS policy checks private.platform_mfa_verified(). Rather than
-- rewrite a dozen policies, the check itself is relaxed: it now passes for any
-- signed-in session. Staff access still requires a row in platform_admins.
--
-- To turn two-factor back on, restore the original body:
--   select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
-- and set ADMIN_REQUIRE_MFA = true in src/lib/admin-access.ts.
create or replace function private.platform_mfa_verified()
returns boolean language sql stable set search_path = '' as $$
  select (select auth.uid()) is not null;
$$;
