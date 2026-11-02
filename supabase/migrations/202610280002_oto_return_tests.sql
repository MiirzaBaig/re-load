-- Private, sandbox-only return acceptance attempts. No customer/contact payload storage.
create table private.oto_return_tests (
 id uuid primary key, store_id uuid not null references public.stores(id), user_id uuid not null,
 fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
 courier_id text not null check(courier_id in ('2828','56468','56469','56470','56471')),
 quote_halalas integer not null check(quote_halalas>0), cap_halalas integer not null check(cap_halalas between 1 and 1000000 and cap_halalas>=quote_halalas),
 state text not null default 'DRAFT' check(state in ('DRAFT','WAREHOUSE_CREATING','WAREHOUSE_READY','ORDER_CREATING','ORDER_READY','RETURN_CREATING','RETURN_SAVED','EXPIRED')),
 return_order_ref text, shipment_ref text,
 expires_at timestamptz not null default now()+interval '10 minutes',created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index oto_return_test_active on private.oto_return_tests(store_id) where state<>'EXPIRED';
alter table private.oto_return_tests enable row level security;
revoke all on private.oto_return_tests from public,anon,authenticated,service_role;

create table private.oto_return_test_events(id bigint generated always as identity primary key,attempt_id uuid not null references private.oto_return_tests(id),stage text not null,created_at timestamptz not null default now());
alter table private.oto_return_test_events enable row level security;
revoke all on private.oto_return_test_events from public,anon,authenticated,service_role;
revoke all on sequence private.oto_return_test_events_id_seq from public,anon,authenticated,service_role;
create function public.oto_return_test_record(p_store uuid,p_id uuid default null) returns jsonb
language sql security definer set search_path='' as $$
 select to_jsonb(t)||jsonb_build_object('events',coalesce((select jsonb_agg(to_jsonb(e) - 'id' - 'attempt_id' order by e.id) from(select * from private.oto_return_test_events where attempt_id=t.id order by id desc limit 30)e),'[]'::jsonb)) from private.oto_return_tests t where store_id=p_store and (p_id is null or id=p_id) order by created_at desc limit 1
$$;
create function public.oto_return_test_prepare(p_id uuid,p_store uuid,p_user uuid,p_fingerprint text,p_courier text,p_quote integer,p_cap integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t private.oto_return_tests;
begin
 if p_id is null or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' or p_courier is null or p_courier not in ('2828','56468','56469','56470','56471') or p_quote is null or p_cap is null or p_quote<=0 or p_cap<p_quote or p_cap>1000000 then raise exception 'invalid_test';end if;
 if not exists(select 1 from public.memberships where store_id=p_store and user_id=p_user and role in ('owner','admin')) then raise exception 'insufficient_permission';end if;
 if not exists(select 1 from public.store_billing where store_id=p_store and environment='sandbox' and plan='premium' and status='ACTIVE' and period_start<=now() and period_end>now()) then raise exception 'premium_required';end if;
 perform pg_advisory_xact_lock(hashtext('oto_return_test'),hashtext(p_store::text));
 select * into t from private.oto_return_tests where id=p_id;
 if found then
  if t.store_id<>p_store or t.user_id<>p_user or t.state<>'DRAFT' then raise exception 'test_mismatch';end if;
  update private.oto_return_tests set fingerprint=p_fingerprint,courier_id=p_courier,quote_halalas=p_quote,cap_halalas=p_cap,expires_at=now()+interval '10 minutes',updated_at=now() where id=p_id returning * into t;
  return to_jsonb(t);
 end if;
 -- Only an unsubmitted draft can expire. An uncertain submission never unlocks by time.
 update private.oto_return_tests set state='EXPIRED',updated_at=now() where store_id=p_store and state='DRAFT' and expires_at<=now();
 if exists(select 1 from private.oto_return_tests where store_id=p_store and state<>'EXPIRED') then raise exception 'earlier_test_needs_review';end if;
 insert into private.oto_return_tests(id,store_id,user_id,fingerprint,courier_id,quote_halalas,cap_halalas) values(p_id,p_store,p_user,p_fingerprint,p_courier,p_quote,p_cap) returning * into t;
 insert into private.oto_return_test_events(attempt_id,stage) values(p_id,'DRAFT');
 return to_jsonb(t);
end $$;
create function public.oto_return_test_claim(p_store uuid,p_id uuid,p_user uuid,p_fingerprint text) returns boolean
language plpgsql security definer set search_path='' as $$
declare t private.oto_return_tests; w uuid;
begin
 perform pg_advisory_xact_lock(hashtext('oto_return_test'),hashtext(p_store::text));
 select * into t from private.oto_return_tests where id=p_id and store_id=p_store for update;
 if not found or t.user_id<>p_user or t.fingerprint<>p_fingerprint then raise exception 'test_mismatch';end if;
 if t.state<>'DRAFT' then return false;end if;
 if t.expires_at<=now() then raise exception 'test_expired';end if;
 if not exists(select 1 from public.memberships where store_id=p_store and user_id=p_user and role in ('owner','admin')) or not exists(select 1 from public.store_billing where store_id=p_store and environment='sandbox' and plan='premium' and status='ACTIVE' and period_start<=now() and period_end>now()) then raise exception 'premium_required';end if;
 w:=public.shipping_register_warehouse(p_store,'sandbox','RLDW'||replace(p_id::text,'-',''));
 perform public.shipping_reserve_attempt(p_id,p_store,'sandbox',w,null,t.cap_halalas,t.cap_halalas,t.expires_at);
 if not public.shipping_claim_submission(p_id,p_store,'sandbox') then raise exception 'submission_unavailable';end if;
 update private.oto_return_tests set state='WAREHOUSE_CREATING',updated_at=now() where id=p_id;
 insert into private.oto_return_test_events(attempt_id,stage) values(p_id,'WAREHOUSE_CREATING');
 return true;
end $$;
create function public.oto_return_test_advance(p_store uuid,p_id uuid,p_from text,p_to text,p_return text default null) returns void
language plpgsql security definer set search_path='' as $$
declare parent_ref text:='RLDTEST-'||replace(p_id::text,'-','');
begin
 if p_from is null or p_to is null or (p_from,p_to) not in (('WAREHOUSE_CREATING','WAREHOUSE_READY'),('WAREHOUSE_READY','ORDER_CREATING'),('ORDER_CREATING','ORDER_READY'),('ORDER_READY','RETURN_CREATING'),('RETURN_CREATING','RETURN_SAVED')) then raise exception 'invalid_test_transition';end if;
 if p_to='RETURN_SAVED' and (p_return is null or p_return !~ ('^'||parent_ref||'-R[0-9]{1,6}$')) then raise exception 'return_reference_mismatch';end if;
 update private.oto_return_tests set state=p_to,return_order_ref=case when p_to='RETURN_SAVED' then p_return else return_order_ref end,updated_at=now() where id=p_id and store_id=p_store and state=p_from;
 if not found then raise exception 'test_transition_mismatch';end if;
 insert into private.oto_return_test_events(attempt_id,stage) values(p_id,p_to);
end $$;
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'oto_return_test_%' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
