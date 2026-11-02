#!/bin/sh
# Isolated local SQL only; never reads .env or calls OTO/payment services.
set -eu
case "${PGHOST:-localhost}" in localhost|127.0.0.1|/tmp|/var/run/postgresql) ;; *) echo 'Local PostgreSQL only.' >&2; exit 1;; esac
shipping_test_db="reload_shipping_contract_$$"
createdb "$shipping_test_db"
trap 'dropdb --if-exists "$shipping_test_db"' EXIT HUP INT TERM
{
 printf '%s\n' '\set ON_ERROR_STOP on' 'begin;' "do \$\$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end \$\$;"
 printf '%s\n' '\i supabase/tests/fixtures/shipping-bootstrap.sql' '\i supabase/migrations/202610270001_shipping_records.sql' '\i supabase/tests/shipping-records.sql' '\i supabase/migrations/202610280001_shipping_topups.sql' '\i supabase/tests/shipping-topups.sql' '\i supabase/migrations/202610280003_shipping_topup_expiry.sql' '\i supabase/tests/shipping-topup-expiry.sql' '\i supabase/migrations/202610280002_oto_return_tests.sql' '\i supabase/tests/oto-return-tests.sql' '\i supabase/migrations/202610310001_oto_async_returns.sql' '\i supabase/tests/oto-async-returns.sql' '\i supabase/migrations/202610310002_shipping_settings.sql' '\i supabase/tests/shipping-settings.sql' '\i supabase/tests/fixtures/collection-bootstrap.sql' '\i supabase/migrations/202610310003_whatsapp_collection.sql' '\i supabase/migrations/202610310004_collection_transport_retention.sql' '\i supabase/tests/whatsapp-collection.sql' '\i supabase/migrations/202610310005_shipping_automation.sql' '\i supabase/tests/shipping-automation.sql' 'rollback;'
} | psql -X -v ON_ERROR_STOP=1 -d "$shipping_test_db"
