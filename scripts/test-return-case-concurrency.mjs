// Disposable local PostgreSQL only. Never loads private environment files.
// Example: PGHOST=127.0.0.1 PGPORT=5432 node scripts/test-return-case-concurrency.mjs
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const host = process.env.PGHOST || "127.0.0.1";
if (!["127.0.0.1", "localhost", "/tmp"].includes(host)) throw Error("Local database required");
const db = `reload_return_cases_${process.pid}`;
const connection = ["-h", host, "-p", process.env.PGPORT || "5432"];
const args = ["-X", ...connection, "-d", db, "-v", "ON_ERROR_STOP=1", "-At"];
const exec = (cmd, params) => { const r = spawnSync(cmd, params, { encoding: "utf8" }); if (r.status) throw Error(r.stderr); return r.stdout.trim(); };
const run = sql => exec("psql", [...args, "-c", sql]);
const original = readFileSync("supabase/migrations/202609210001_live_policy_and_returns.sql", "utf8");
const start = original.indexOf("create or replace function public.create_return_case_from_decision(");
assert(start >= 0);
const fn = original.slice(start, original.indexOf("$$;", start) + 3);
const submit = "select public.create_return_case_from_decision('55555555-5555-4555-8555-555555555555','{}','{}')";
const concurrent = () => Promise.all([1, 2].map(() => new Promise((resolve, reject) => {
  const p = spawn("psql", [...args, "-c", submit]); let out = "", err = "";
  p.stdout.on("data", v => out += v); p.stderr.on("data", v => err += v);
  p.on("error", reject); p.on("close", c => c ? reject(Error(err)) : resolve(out.trim()));
})));
exec("createdb", [...connection, db]);
try {
  run(`do $$ begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
  end $$;
  create table public.eligibility_decisions(id uuid primary key,store_id uuid,order_id text,outcome text);
  create table public.return_cases(id uuid default gen_random_uuid(),store_id uuid,decision_id uuid,order_id text,customer_snapshot jsonb,item_snapshot jsonb);
  create table public.audit_events(store_id uuid,event_type text,entity_type text,entity_id uuid,metadata jsonb);
  insert into public.eligibility_decisions values('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','90001','ELIGIBLE');
  create function public.fixture_delay() returns trigger language plpgsql as $$ begin perform pg_sleep(0.3); return new; end $$;
  create trigger fixture_delay before insert on public.return_cases for each row execute function public.fixture_delay();` + fn);
  await concurrent();
  assert.equal(Number(run("select count(*) from public.return_cases")), 2, "baseline reproduces duplicate inserts");
  run("truncate public.return_cases,public.audit_events;" + readFileSync("supabase/migrations/202611100001_return_case_submission_guard.sql", "utf8"));
  const fixed = await concurrent();
  assert.equal(fixed[0], fixed[1], "concurrent requests return the same case");
  assert.equal(Number(run("select count(*) from public.return_cases")), 1);
  assert.equal(run(submit), fixed[0], "later retry returns the same case");
  assert.equal(Number(run("select count(*) from public.audit_events")), 1, "one creation audit event");
  assert.equal(run("select has_function_privilege('anon','public.create_return_case_from_decision(uuid,jsonb,jsonb)','execute')"), "f");
  assert.equal(run("select has_function_privilege('authenticated','public.create_return_case_from_decision(uuid,jsonb,jsonb)','execute')"), "f");
  console.log("PASS: baseline race reproduced; concurrent/repeated submission creates one case and one audit; client execution denied.");
} finally { exec("dropdb", [...connection, "--if-exists", db]); }
