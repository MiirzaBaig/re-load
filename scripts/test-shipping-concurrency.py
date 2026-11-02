#!/usr/bin/env python3
"""Separate local sessions exercise wallet/attempt locks. No provider credentials."""
import json
import os
import subprocess
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

if os.environ.get('PGHOST', 'localhost') not in ('localhost', '127.0.0.1', '/tmp', '/var/run/postgresql'):
    raise SystemExit('Local PostgreSQL only.')
db = 'reload_shipping_races_' + str(os.getpid())

def sql(query, check=True):
    result = subprocess.run(['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-d', db], input=query, text=True, capture_output=True)
    if check and result.returncode:
        raise RuntimeError(result.stderr)
    return result

def reserve(attempt, store, warehouse, amount):
    # Same expiry per replay: idempotency must not silently bind a different quote.
    return f"select public.shipping_reserve_attempt('{attempt}','{store}','sandbox','{warehouse}',null,{amount},{amount},'2099-01-01');"

subprocess.run(['createdb', db], check=True)
try:
    roles = "do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role;end if;end $$;"
    sql(roles + Path('supabase/tests/fixtures/shipping-bootstrap.sql').read_text() + Path('supabase/migrations/202610270001_shipping_records.sql').read_text())
    store = str(uuid.uuid4())
    sql(f"insert into public.stores values('{store}');select public.shipping_apply_verified_topup('{store}','sandbox','race-topup',10000);")
    warehouse = sql(f"select public.shipping_register_warehouse('{store}','sandbox','RACE-WAREHOUSE');").stdout.strip()
    expiry = sql("select (now()+interval '20 minutes')::text;").stdout.strip()
    def command(attempt, amount):
        return reserve(attempt, store, warehouse, amount).replace('2099-01-01', expiry)
    ids = [str(uuid.uuid4()), str(uuid.uuid4())]
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(lambda attempt: sql(command(attempt, 7000), False), ids))
    assert sum(r.returncode == 0 for r in outcomes) == 1, 'competing bookings both spent the balance'
    assert any('shipping_insufficient_balance' in r.stderr for r in outcomes), 'wrong losing result'
    winner = ids[next(i for i, r in enumerate(outcomes) if r.returncode == 0)]
    before = sql(f"select available_halalas||','||reserved_halalas from private.shipping_wallets where store_id='{store}';").stdout.strip()
    assert before == '3000,7000', before
    with ThreadPoolExecutor(max_workers=2) as pool:
        replays = list(pool.map(lambda _: sql(command(winner, 7000)), range(2)))
    assert all(json.loads(r.stdout)['claimed'] is False for r in replays), 'duplicate reservation claim'
    with ThreadPoolExecutor(max_workers=2) as pool:
        claims = list(pool.map(lambda _: sql(f"select public.shipping_claim_submission('{winner}','{store}','sandbox');"), range(2)))
    assert sorted(r.stdout.strip() for r in claims) == ['f', 't'], 'duplicate provider submission'
    with ThreadPoolExecutor(max_workers=2) as pool:
        settlements = list(pool.map(lambda _: sql(f"select public.shipping_finish_attempt('{winner}','{store}','sandbox','BOOKED',6500,'RACE-SHIP','RACE-CHARGE');"), range(2)))
    assert sorted(r.stdout.strip() for r in settlements) == ['f', 't'], 'duplicate settlement'
    with ThreadPoolExecutor(max_workers=2) as pool:
        credits = list(pool.map(lambda _: sql(f"select public.shipping_apply_provider_credit('{winner}','{store}','sandbox','RACE-CREDIT',6500,true);"), range(2)))
    assert sorted(r.stdout.strip() for r in credits) == ['f', 't'], 'duplicate credit'
    final = sql(f"select available_halalas||','||reserved_halalas||','||spent_halalas from private.shipping_wallets where store_id='{store}';").stdout.strip()
    assert final == '10000,0,0', final
    assert sql("select count(*) from private.shipping_ledger;").stdout.strip() == '4', 'duplicate financial rows'
    # Real roles cannot call write RPCs or read private tables.
    denied = sql(f"set role authenticated;select public.shipping_apply_verified_topup('{store}','sandbox','forged',100);", False)
    assert denied.returncode != 0 and 'permission denied' in denied.stderr, 'authenticated credit bypass'
    denied = sql("set role authenticated;select * from private.shipping_ledger;", False)
    assert denied.returncode != 0 and 'permission denied' in denied.stderr, 'private table leak'
    print(json.dumps({'concurrentOverspendPrevented': True, 'duplicateReservationPrevented': True, 'singleSubmissionClaim': True, 'singleSettlement': True, 'singleCredit': True, 'realRoleDenials': True, 'finalBalanceHalalas': 10000, 'providerCalls': 0}))
finally:
    subprocess.run(['dropdb', '--if-exists', db], check=True)
