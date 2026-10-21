#!/bin/sh
set -eu
case "${PGHOST:-localhost}" in localhost|127.0.0.1|/tmp|/var/run/postgresql) ;; *) echo 'Use a local PostgreSQL server only.' >&2; exit 1;; esac
zid_test_db="reload_zid_dev_contract_$$"
createdb "$zid_test_db"
trap 'dropdb --if-exists "$zid_test_db"' EXIT HUP INT TERM
{
 printf '%s\n' '\set ON_ERROR_STOP on' 'begin;' "do \$\$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end \$\$;" 'create schema private;' 'revoke all on schema private from public;'
 printf '%s\n' '\i supabase/migrations/202610210001_zid_dev_oauth.sql' '\i supabase/tests/zid-dev-oauth.sql' 'rollback;'
} | psql -X -v ON_ERROR_STOP=1 -d "$zid_test_db"
