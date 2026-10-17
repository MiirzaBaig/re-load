#!/bin/sh
# Isolated local PostgreSQL contract tests. Never loads provider credentials.
set -eu
case "${PGHOST:-localhost}" in localhost|127.0.0.1|/tmp|/var/run/postgresql) ;; *) echo 'Use a local PostgreSQL server for billing contract tests.' >&2; exit 1;; esac
test_db="reload_billing_contract_$$"
createdb "$test_db"
trap 'dropdb --if-exists "$test_db"' EXIT HUP INT TERM
{
  printf '%s\n' '\set ON_ERROR_STOP on' 'begin;' "do \$\$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end \$\$;"
  printf '%s\n' '\i supabase/tests/fixtures/billing-bootstrap.sql'
  for migration in 202610150001_streampay_webhook 202610160001_store_billing 202610160002_billing_reliability 202610170001_billing_resubscribe 202610170002_annual_billing 202610170003_early_paid_renewals; do
    printf '\\i supabase/migrations/%s.sql\n' "$migration"
  done
  # billing.sql includes the original rollback; keep both suites in one transaction.
  sed '/^[Rr][Oo][Ll][Ll][Bb][Aa][Cc][Kk];/d' supabase/tests/billing.sql
  printf '%s\n' '\i supabase/tests/annual-billing.sql' 'rollback;'
} | psql -X -v ON_ERROR_STOP=1 -d "$test_db"
