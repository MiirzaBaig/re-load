-- Recordkeeping foundation only. No provider calls, payment links or live shipping activation.
create table private.shipping_wallets (
 store_id uuid not null references public.stores(id),
 environment text not null check(environment in ('sandbox','live')),
 on_hold boolean not null default false,
 available_halalas bigint not null default 0 check(available_halalas between 0 and 1000000000000),
 reserved_halalas bigint not null default 0 check(reserved_halalas between 0 and 1000000000000),
 spent_halalas bigint not null default 0 check(spent_halalas between 0 and 1000000000000),
 updated_at timestamptz not null default now(), primary key(store_id,environment)
);
create table private.shipping_warehouses (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id),
 environment text not null check(environment in ('sandbox','live')),
 provider_code text not null check(provider_code ~ '^[A-Za-z0-9_-]{1,100}$'),
 state text not null default 'ACTIVE' check(state in ('ACTIVE','INACTIVE')),
 created_at timestamptz not null default now(), unique(store_id,environment,id), unique(environment,provider_code)
);
create table private.shipping_attempts (
 id uuid primary key, store_id uuid not null, environment text not null,
 warehouse_id uuid not null, case_id uuid references public.return_cases(id),
 state text not null default 'RESERVED' check(state in ('RESERVED','SUBMITTING','UNKNOWN','BOOKED','FAILED','CANCELLED')),
 quote_halalas integer not null check(quote_halalas between 1 and 10000000),
 approved_cap_halalas integer not null check(approved_cap_halalas between 1 and 10000000 and approved_cap_halalas>=quote_halalas),
 quote_expires_at timestamptz not null,
 provider_order_ref text not null check(provider_order_ref ~ '^RLDTEST-[A-Fa-f0-9]{32}$'),
 provider_shipment_ref text check(provider_shipment_ref ~ '^[A-Za-z0-9_.:-]{1,120}$'),
 settled_halalas integer check(settled_halalas between 1 and 10000000),
 credited_halalas integer not null default 0 check(credited_halalas>=0 and credited_halalas<=coalesce(settled_halalas,0)),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(store_id,environment) references private.shipping_wallets(store_id,environment),
 foreign key(store_id,environment,warehouse_id) references private.shipping_warehouses(store_id,environment,id),
 unique(environment,provider_order_ref), unique(environment,provider_shipment_ref)
);
create unique index shipping_one_active_case on private.shipping_attempts(store_id,environment,case_id)
 where case_id is not null and state not in ('FAILED','CANCELLED');
create index shipping_attempt_store on private.shipping_attempts(store_id,environment,created_at desc);
create table private.shipping_ledger (
 id bigint generated always as identity primary key,
 store_id uuid not null, environment text not null, attempt_id uuid references private.shipping_attempts(id),
 kind text not null check(kind in ('TOPUP','RESERVE','SETTLE','RELEASE','PROVIDER_CREDIT')),
 reference text not null check(reference ~ '^[A-Za-z0-9_.:-]{1,160}$'),
 available_delta bigint not null, reserved_delta bigint not null, spent_delta bigint not null,
 created_at timestamptz not null default now(),
 foreign key(store_id,environment) references private.shipping_wallets(store_id,environment),
 unique(environment,kind,reference),
 check(case kind
  when 'TOPUP' then attempt_id is null and available_delta>0 and reserved_delta=0 and spent_delta=0
  when 'RESERVE' then attempt_id is not null and available_delta<0 and reserved_delta=-available_delta and spent_delta=0
  when 'SETTLE' then attempt_id is not null and available_delta>=0 and reserved_delta<0 and spent_delta>0 and available_delta+reserved_delta+spent_delta=0
  when 'RELEASE' then attempt_id is not null and available_delta>0 and reserved_delta=-available_delta and spent_delta=0
  when 'PROVIDER_CREDIT' then attempt_id is not null and available_delta>0 and reserved_delta=0 and spent_delta=-available_delta
 end)
);
create index shipping_ledger_store on private.shipping_ledger(store_id,environment,id desc);
create table private.shipping_attempt_events (
 id bigint generated always as identity primary key,
 attempt_id uuid not null references private.shipping_attempts(id),
 stage text not null check(stage in ('RESERVED','SUBMITTING','UNKNOWN','BOOKED','FAILED','CANCELLED','PROVIDER_CREDIT','PROVIDER_REFERENCE_SAVED')),
 created_at timestamptz not null default now()
);
create index shipping_events_attempt on private.shipping_attempt_events(attempt_id,id);

-- Append-only financial evidence. Corrections use linked credits, never edits/deletes.
create function private.shipping_immutable() returns trigger
language plpgsql set search_path='' as $$ begin raise exception 'shipping_record_immutable';end $$;
create trigger shipping_ledger_immutable before update or delete on private.shipping_ledger for each row execute function private.shipping_immutable();
create trigger shipping_events_immutable before update or delete on private.shipping_attempt_events for each row execute function private.shipping_immutable();

-- Mutation RPCs in this foundation reject LIVE unconditionally. A later reviewed migration
-- must implement full Premium, policy, approval, provider-funding and rollout gates first.
create function private.shipping_require_sandbox(p_environment text) returns void
language plpgsql set search_path='' as $$ begin
 if p_environment is distinct from 'sandbox' then raise exception 'shipping_live_disabled';end if;
end $$;

create function public.shipping_register_warehouse(p_store uuid,p_environment text,p_provider_code text) returns uuid
language plpgsql security definer set search_path='' as $$
declare existing uuid;
begin
 perform private.shipping_require_sandbox(p_environment);
 if p_store is null or p_provider_code is null or p_provider_code !~ '^[A-Za-z0-9_-]{1,100}$' then raise exception 'invalid_warehouse';end if;
 perform pg_advisory_xact_lock(hashtext('shipping_warehouse'),hashtext(p_environment||p_provider_code));
 select id into existing from private.shipping_warehouses where environment=p_environment and provider_code=p_provider_code;
 if existing is not null then
  if not exists(select 1 from private.shipping_warehouses where id=existing and store_id=p_store and state='ACTIVE') then raise exception 'warehouse_mismatch';end if;
  return existing;
 end if;
 insert into private.shipping_warehouses(store_id,environment,provider_code) values(p_store,p_environment,p_provider_code) returning id into existing;
 return existing;
end $$;

-- Only the future server-side payment verifier may call this AFTER authoritative
-- provider verification. This RPC does not itself verify a payment or expose a top-up API.
create function public.shipping_apply_verified_topup(p_store uuid,p_environment text,p_payment_ref text,p_amount integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare old private.shipping_ledger;
begin
 perform private.shipping_require_sandbox(p_environment);
 if p_store is null or p_amount is null or p_amount not between 1 and 10000000 or p_payment_ref is null or p_payment_ref !~ '^[A-Za-z0-9_.:-]{1,160}$' then raise exception 'invalid_topup';end if;
 perform pg_advisory_xact_lock(hashtext('shipping_topup'),hashtext(p_environment||p_payment_ref));
 select * into old from private.shipping_ledger where environment=p_environment and kind='TOPUP' and reference=p_payment_ref;
 if found then
  if old.store_id<>p_store or old.available_delta<>p_amount then raise exception 'payment_reference_mismatch';end if;
  return false;
 end if;
 insert into private.shipping_wallets(store_id,environment) values(p_store,p_environment) on conflict do nothing;
 perform 1 from private.shipping_wallets where store_id=p_store and environment=p_environment for update;
 update private.shipping_wallets set available_halalas=available_halalas+p_amount,updated_at=now() where store_id=p_store and environment=p_environment;
 insert into private.shipping_ledger(store_id,environment,kind,reference,available_delta,reserved_delta,spent_delta) values(p_store,p_environment,'TOPUP',p_payment_ref,p_amount,0,0);
 return true;
end $$;

create function public.shipping_reserve_attempt(p_id uuid,p_store uuid,p_environment text,p_warehouse uuid,p_case uuid,p_quote integer,p_cap integer,p_quote_expires timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a private.shipping_attempts; wallet private.shipping_wallets;
begin
 perform private.shipping_require_sandbox(p_environment);
 if p_id is null or p_store is null or p_warehouse is null or p_quote is null or p_cap is null or p_quote not between 1 and 10000000 or p_cap not between p_quote and 10000000 or p_quote_expires is null then raise exception 'invalid_reservation';end if;
 -- Shared lock order: attempt id, then tenant wallet. No concurrent duplicate key can cross tenants.
 perform pg_advisory_xact_lock(hashtext('shipping_attempt'),hashtext(p_id::text));
 select * into a from private.shipping_attempts where id=p_id;
 if found then
  if a.store_id<>p_store or a.environment<>p_environment or a.warehouse_id<>p_warehouse or a.case_id is distinct from p_case or a.quote_halalas<>p_quote or a.approved_cap_halalas<>p_cap or a.quote_expires_at<>p_quote_expires then raise exception 'attempt_mismatch';end if;
  return jsonb_build_object('claimed',false,'id',a.id,'state',a.state);
 end if;
 if p_quote_expires<=now() or p_quote_expires>now()+interval '30 minutes' then raise exception 'quote_expired';end if;
 select * into wallet from private.shipping_wallets where store_id=p_store and environment=p_environment for update;
 if not found or wallet.available_halalas<p_quote then raise exception 'shipping_insufficient_balance';end if;
 if wallet.on_hold then raise exception 'shipping_wallet_review';end if;
 if not exists(select 1 from private.shipping_warehouses where id=p_warehouse and store_id=p_store and environment=p_environment and state='ACTIVE') then raise exception 'warehouse_mismatch';end if;
 if p_case is not null and not exists(select 1 from public.return_cases where id=p_case and store_id=p_store and status='OPEN') then raise exception 'case_mismatch';end if;
 -- An unresolved external write blocks further reservations for this merchant.
 if exists(select 1 from private.shipping_attempts where store_id=p_store and environment=p_environment and state in ('SUBMITTING','UNKNOWN')) then raise exception 'shipping_unconfirmed_attempt';end if;
 insert into private.shipping_attempts(id,store_id,environment,warehouse_id,case_id,quote_halalas,approved_cap_halalas,quote_expires_at,provider_order_ref)
 values(p_id,p_store,p_environment,p_warehouse,p_case,p_quote,p_cap,p_quote_expires,'RLDTEST-'||replace(p_id::text,'-','')) returning * into a;
 update private.shipping_wallets set available_halalas=available_halalas-p_quote,reserved_halalas=reserved_halalas+p_quote,updated_at=now() where store_id=p_store and environment=p_environment;
 insert into private.shipping_ledger(store_id,environment,attempt_id,kind,reference,available_delta,reserved_delta,spent_delta) values(p_store,p_environment,p_id,'RESERVE',p_id::text,-p_quote,p_quote,0);
 insert into private.shipping_attempt_events(attempt_id,stage) values(p_id,'RESERVED');
 return jsonb_build_object('claimed',true,'id',a.id,'state',a.state);
end $$;

-- The server must win this claim immediately before the FIRST provider creation call.
create function public.shipping_claim_submission(p_id uuid,p_store uuid,p_environment text) returns boolean
language plpgsql security definer set search_path='' as $$
declare a private.shipping_attempts;
begin
 perform private.shipping_require_sandbox(p_environment);
 perform pg_advisory_xact_lock(hashtext('shipping_attempt'),hashtext(p_id::text));
 select * into a from private.shipping_attempts where id=p_id and store_id=p_store and environment=p_environment;
 if not found then raise exception 'attempt_missing';end if;
 perform 1 from private.shipping_wallets where store_id=p_store and environment=p_environment for update;
 if a.state<>'RESERVED' then return false;end if;
 if exists(select 1 from private.shipping_wallets where store_id=p_store and environment=p_environment and on_hold) then raise exception 'shipping_wallet_review';end if;
 if a.quote_expires_at<=now() then raise exception 'quote_expired';end if;
 if not exists(select 1 from private.shipping_warehouses where id=a.warehouse_id and store_id=p_store and environment=p_environment and state='ACTIVE') then raise exception 'warehouse_mismatch';end if;
 if a.case_id is not null and not exists(select 1 from public.return_cases where id=a.case_id and store_id=p_store and status='OPEN') then raise exception 'case_mismatch';end if;
 if exists(select 1 from private.shipping_attempts where id<>p_id and store_id=p_store and environment=p_environment and state in ('SUBMITTING','UNKNOWN')) then raise exception 'shipping_unconfirmed_attempt';end if;
 update private.shipping_attempts set state='SUBMITTING',updated_at=now() where id=p_id;
 insert into private.shipping_attempt_events(attempt_id,stage) values(p_id,'SUBMITTING');
 return true;
end $$;

-- Preserve a provider reference before later parsing/settlement, without claiming success.
create function public.shipping_note_provider_reference(p_id uuid,p_store uuid,p_environment text,p_provider_ref text) returns boolean
language plpgsql security definer set search_path='' as $$
declare a private.shipping_attempts;
begin
 perform private.shipping_require_sandbox(p_environment);
 if p_provider_ref is null or p_provider_ref !~ '^[A-Za-z0-9_.:-]{1,120}$' then raise exception 'invalid_provider_reference';end if;
 perform pg_advisory_xact_lock(hashtext('shipping_attempt'),hashtext(p_id::text));
 select * into a from private.shipping_attempts where id=p_id and store_id=p_store and environment=p_environment;
 if not found or a.state not in ('SUBMITTING','UNKNOWN','BOOKED') then raise exception 'invalid_shipping_transition';end if;
 if a.provider_shipment_ref is not null then
  if a.provider_shipment_ref<>p_provider_ref then raise exception 'provider_reference_mismatch';end if;
  return false;
 end if;
 update private.shipping_attempts set provider_shipment_ref=p_provider_ref,updated_at=now() where id=p_id;
 insert into private.shipping_attempt_events(attempt_id,stage) values(p_id,'PROVIDER_REFERENCE_SAVED');
 return true;
end $$;

-- Exact tenant-bound server lookup for later workers/reconciliation. No raw table grants.
create function public.shipping_attempt_record(p_id uuid,p_store uuid,p_environment text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_environment is null or p_environment not in ('sandbox','live') then raise exception 'invalid_environment';end if;
 select jsonb_build_object('id',a.id,'storeId',a.store_id,'environment',a.environment,'state',a.state,'warehouseCode',w.provider_code,'caseId',a.case_id,'quoteHalalas',a.quote_halalas,'capHalalas',a.approved_cap_halalas,'quoteExpiresAt',a.quote_expires_at,'providerOrderRef',a.provider_order_ref,'providerShipmentRef',a.provider_shipment_ref,'settledHalalas',a.settled_halalas,'creditedHalalas',a.credited_halalas,
 'events',coalesce((select jsonb_agg(jsonb_build_object('stage',e.stage,'createdAt',e.created_at) order by e.id) from(select * from private.shipping_attempt_events where attempt_id=a.id order by id desc limit 50)e),'[]'::jsonb)) into result
 from private.shipping_attempts a join private.shipping_warehouses w on w.id=a.warehouse_id and w.store_id=a.store_id and w.environment=a.environment
 where a.id=p_id and a.store_id=p_store and a.environment=p_environment;
 return result;
end $$;

-- FAILED may release a reservation only before any provider call (RESERVED).
-- After submission, definitive noncreation requires separate authoritative evidence.
create function public.shipping_finish_attempt(p_id uuid,p_store uuid,p_environment text,p_state text,p_charge integer default null,p_provider_ref text default null,p_evidence_ref text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare a private.shipping_attempts; next_available bigint; next_reserved bigint; next_spent bigint;
begin
 perform private.shipping_require_sandbox(p_environment);
 if p_state is null or p_state not in ('UNKNOWN','BOOKED','FAILED') then raise exception 'invalid_shipping_state';end if;
 perform pg_advisory_xact_lock(hashtext('shipping_attempt'),hashtext(p_id::text));
 select * into a from private.shipping_attempts where id=p_id and store_id=p_store and environment=p_environment;
 if not found then raise exception 'attempt_missing';end if;
 perform 1 from private.shipping_wallets where store_id=p_store and environment=p_environment for update;
 if a.state=p_state then
  if p_state='BOOKED' and (a.settled_halalas is distinct from p_charge or a.provider_shipment_ref is distinct from p_provider_ref) then raise exception 'settlement_mismatch';end if;
  return false;
 end if;
 if p_state='UNKNOWN' then
  if a.state<>'SUBMITTING' or p_charge is not null or p_provider_ref is not null or p_evidence_ref is not null then raise exception 'invalid_shipping_transition';end if;
 elsif p_state='FAILED' then
  if p_charge is not null or p_provider_ref is not null then raise exception 'invalid_release';end if;
  if a.provider_shipment_ref is not null then raise exception 'provider_reference_needs_reconciliation';end if;
  if a.state not in ('RESERVED','SUBMITTING','UNKNOWN') then raise exception 'invalid_shipping_transition';end if;
  if a.state<>'RESERVED' and (p_evidence_ref is null or p_evidence_ref !~ '^[A-Za-z0-9_.:-]{1,160}$') then raise exception 'noncreation_evidence_required';end if;
  next_available:=a.quote_halalas;next_reserved:=-a.quote_halalas;next_spent:=0;
 else
  if a.state not in ('SUBMITTING','UNKNOWN') then raise exception 'invalid_shipping_transition';end if;
  if p_charge is null or p_charge not between 1 and a.quote_halalas or p_charge>a.approved_cap_halalas or p_provider_ref is null or p_provider_ref !~ '^[A-Za-z0-9_.:-]{1,120}$' or p_evidence_ref is null or p_evidence_ref !~ '^[A-Za-z0-9_.:-]{1,160}$' then raise exception 'charge_or_evidence_needs_review';end if;
  if a.provider_shipment_ref is not null and a.provider_shipment_ref<>p_provider_ref then raise exception 'provider_reference_mismatch';end if;
  next_available:=a.quote_halalas-p_charge;next_reserved:=-a.quote_halalas;next_spent:=p_charge;
 end if;
 if p_state<>'UNKNOWN' then
  update private.shipping_wallets set available_halalas=available_halalas+next_available,reserved_halalas=reserved_halalas+next_reserved,spent_halalas=spent_halalas+next_spent,updated_at=now() where store_id=p_store and environment=p_environment;
  insert into private.shipping_ledger(store_id,environment,attempt_id,kind,reference,available_delta,reserved_delta,spent_delta)
   values(p_store,p_environment,p_id,case when p_state='BOOKED' then 'SETTLE' else 'RELEASE' end,coalesce(p_evidence_ref,p_id::text),next_available,next_reserved,next_spent);
 end if;
 update private.shipping_attempts set state=p_state,settled_halalas=case when p_state='BOOKED' then p_charge else settled_halalas end,provider_shipment_ref=case when p_state='BOOKED' then p_provider_ref else provider_shipment_ref end,updated_at=now() where id=p_id;
 insert into private.shipping_attempt_events(attempt_id,stage) values(p_id,p_state);
 return true;
end $$;

-- A provider credit is not a card refund. No release on a mere cancellation request.
create function public.shipping_apply_provider_credit(p_id uuid,p_store uuid,p_environment text,p_credit_ref text,p_amount integer,p_cancel_confirmed boolean default false) returns boolean
language plpgsql security definer set search_path='' as $$
declare a private.shipping_attempts; old private.shipping_ledger;
begin
 perform private.shipping_require_sandbox(p_environment);
 if p_credit_ref is null or p_credit_ref !~ '^[A-Za-z0-9_.:-]{1,160}$' or p_amount is null or p_amount<=0 or p_cancel_confirmed is null then raise exception 'invalid_credit';end if;
 perform pg_advisory_xact_lock(hashtext('shipping_credit'),hashtext(p_environment||p_credit_ref));
 perform pg_advisory_xact_lock(hashtext('shipping_attempt'),hashtext(p_id::text));
 select * into a from private.shipping_attempts where id=p_id and store_id=p_store and environment=p_environment;
 if not found then raise exception 'attempt_missing';end if;
 perform 1 from private.shipping_wallets where store_id=p_store and environment=p_environment for update;
 select * into old from private.shipping_ledger where environment=p_environment and kind='PROVIDER_CREDIT' and reference=p_credit_ref;
 if found then
  if old.attempt_id<>p_id or old.store_id<>p_store or old.available_delta<>p_amount then raise exception 'credit_reference_mismatch';end if;
  return false;
 end if;
 if a.state not in ('BOOKED','CANCELLED') or p_amount>a.settled_halalas-a.credited_halalas then raise exception 'credit_needs_review';end if;
 update private.shipping_wallets set available_halalas=available_halalas+p_amount,spent_halalas=spent_halalas-p_amount,updated_at=now() where store_id=p_store and environment=p_environment;
 update private.shipping_attempts set credited_halalas=credited_halalas+p_amount,state=case when p_cancel_confirmed then 'CANCELLED' else state end,updated_at=now() where id=p_id;
 insert into private.shipping_ledger(store_id,environment,attempt_id,kind,reference,available_delta,reserved_delta,spent_delta) values(p_store,p_environment,p_id,'PROVIDER_CREDIT',p_credit_ref,p_amount,0,-p_amount);
 insert into private.shipping_attempt_events(attempt_id,stage) values(p_id,case when p_cancel_confirmed then 'CANCELLED' else 'PROVIDER_CREDIT' end);
 return true;
end $$;

create function public.shipping_wallet_snapshot(p_store uuid,p_environment text default 'live') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_environment is null or p_environment not in ('sandbox','live') then raise exception 'invalid_environment';end if;
 if coalesce(auth.role(),'anon')<>'service_role' and private.is_store_member(p_store) is not true then
  if private.is_platform_owner() is not true or private.platform_mfa_verified() is not true then raise exception 'insufficient_permission' using errcode='42501';end if;
  insert into public.platform_admin_events(actor_user_id,event_type,entity_type,entity_id) values(auth.uid(),'SHIPPING_WALLET_VIEWED','shipping_wallet',p_store);
 end if;
 select jsonb_build_object('environment',p_environment,'currency','SAR','onHold',coalesce(w.on_hold,false),'availableHalalas',coalesce(w.available_halalas,0),'reservedHalalas',coalesce(w.reserved_halalas,0),'spentHalalas',coalesce(w.spent_halalas,0),
 'entries',coalesce((select jsonb_agg(jsonb_build_object('kind',e.kind,'availableDelta',e.available_delta,'reservedDelta',e.reserved_delta,'spentDelta',e.spent_delta,'createdAt',e.created_at) order by e.id desc) from(select * from private.shipping_ledger where store_id=p_store and environment=p_environment order by id desc limit 50)e),'[]'::jsonb),
 'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'state',a.state,'reservedHalalas',case when a.state in ('RESERVED','SUBMITTING','UNKNOWN') then a.quote_halalas else 0 end,'chargedHalalas',a.settled_halalas,'creditedHalalas',a.credited_halalas,'updatedAt',a.updated_at) order by a.created_at desc) from(select * from private.shipping_attempts where store_id=p_store and environment=p_environment order by created_at desc,id desc limit 30)a),'[]'::jsonb)) into result
 from (select 1) seed left join private.shipping_wallets w on w.store_id=p_store and w.environment=p_environment;
 return result;
end $$;

-- No public/private table reads or writes; use explicit safe RPCs only.
do $$ declare t text; f record; begin
 foreach t in array array['shipping_wallets','shipping_warehouses','shipping_attempts','shipping_ledger','shipping_attempt_events'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 end loop;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('shipping_note_provider_reference','shipping_attempt_record','shipping_register_warehouse','shipping_apply_verified_topup','shipping_reserve_attempt','shipping_claim_submission','shipping_finish_attempt','shipping_apply_provider_credit','shipping_wallet_snapshot') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
revoke all on function private.shipping_immutable() from public,anon,authenticated,service_role;
revoke all on function private.shipping_require_sandbox(text) from public,anon,authenticated,service_role;
grant execute on function public.shipping_wallet_snapshot(uuid,text) to authenticated;

revoke all on sequence private.shipping_ledger_id_seq, private.shipping_attempt_events_id_seq from public,anon,authenticated,service_role;
