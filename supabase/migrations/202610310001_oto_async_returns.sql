-- Sandbox acceptance: asynchronous receipts, verified legacy reverse references,
-- and explicit per-shipment approval when a recorded charge exceeds the old cap.
alter table private.oto_return_tests drop constraint oto_return_tests_state_check;
alter table private.oto_return_tests add constraint oto_return_tests_state_check check(state in ('DRAFT','WAREHOUSE_CREATING','WAREHOUSE_READY','ORDER_CREATING','ORDER_READY','RETURN_CREATING','RETURN_REQUESTED','RETURN_SAVED','EXPIRED'));
create or replace function public.oto_return_test_advance(p_store uuid,p_id uuid,p_from text,p_to text,p_return text default null) returns void
language plpgsql security definer set search_path='' as $$
declare parent_ref text:='RLDTEST-'||replace(p_id::text,'-','');
begin
 if p_from is null or p_to is null or (p_from,p_to) not in (('WAREHOUSE_CREATING','WAREHOUSE_READY'),('WAREHOUSE_READY','ORDER_CREATING'),('ORDER_CREATING','ORDER_READY'),('ORDER_READY','RETURN_CREATING'),('RETURN_CREATING','RETURN_REQUESTED'),('RETURN_CREATING','RETURN_SAVED'),('RETURN_REQUESTED','RETURN_SAVED')) then raise exception 'invalid_test_transition';end if;
 -- Same-reference reverse shipments require server verification of the exact
 -- warehouse, return items and return-specific shipment history before this call.
 if p_to='RETURN_SAVED' and (p_return is null or (p_return<>parent_ref and p_return !~ ('^'||parent_ref||'-R[0-9]{1,6}$'))) then raise exception 'return_reference_mismatch';end if;
 update private.oto_return_tests set state=p_to,return_order_ref=case when p_to='RETURN_SAVED' then p_return else return_order_ref end,updated_at=now() where id=p_id and store_id=p_store and state=p_from;
 if not found then raise exception 'test_transition_mismatch';end if;
 insert into private.oto_return_test_events(attempt_id,stage) values(p_id,p_to);
end $$;
create table private.oto_test_charge_approvals(
 id bigint generated always as identity primary key,attempt_id uuid not null references private.oto_return_tests(id),store_id uuid not null references public.stores(id),actor_user_id uuid not null,amount_halalas integer not null,shipment_ref text not null,created_at timestamptz not null default now(),unique(attempt_id,amount_halalas)
);
alter table private.oto_test_charge_approvals enable row level security;
revoke all on private.oto_test_charge_approvals from public,anon,authenticated,service_role;
revoke all on sequence private.oto_test_charge_approvals_id_seq from public,anon,authenticated,service_role;
create trigger oto_test_charge_approvals_immutable before update or delete on private.oto_test_charge_approvals for each row execute function private.shipping_immutable();
create function public.oto_return_test_approve_charge(p_store uuid,p_id uuid,p_user uuid,p_amount integer,p_shipment text) returns boolean
language plpgsql security definer set search_path='' as $$
declare t private.oto_return_tests;a private.shipping_attempts;w private.shipping_wallets;extra integer;
begin
 if p_store is null or p_id is null or p_user is null or p_amount is null or p_amount not between 1 and 1000000 or p_shipment is null then raise exception 'invalid_approval';end if;
 perform pg_advisory_xact_lock(hashtext('oto_return_test'),hashtext(p_store::text));
 perform pg_advisory_xact_lock(hashtext('shipping_attempt'),hashtext(p_id::text));
 select * into t from private.oto_return_tests where id=p_id and store_id=p_store for update;
 select * into a from private.shipping_attempts where id=p_id and store_id=p_store and environment='sandbox';
 if t.id is null or a.id is null or t.state<>'RETURN_SAVED' or a.provider_shipment_ref is distinct from p_shipment then raise exception 'shipment_mismatch';end if;
 if not exists(select 1 from public.memberships where store_id=p_store and user_id=p_user and role in ('owner','admin')) or not exists(select 1 from public.store_billing where store_id=p_store and environment='sandbox' and plan='premium' and status='ACTIVE' and period_start<=now() and period_end>now()) then raise exception 'insufficient_permission';end if;
 if t.cap_halalas=p_amount and a.approved_cap_halalas=p_amount then return false;end if;
 if a.state not in ('SUBMITTING','UNKNOWN') or p_amount<=t.cap_halalas then raise exception 'invalid_approval';end if;
 select * into w from private.shipping_wallets where store_id=p_store and environment='sandbox' for update;
 extra:=p_amount-a.quote_halalas;
 if w.on_hold or w.available_halalas<extra or extra<=0 then raise exception 'insufficient_funds';end if;
 insert into private.oto_test_charge_approvals(attempt_id,store_id,actor_user_id,amount_halalas,shipment_ref) values(p_id,p_store,p_user,p_amount,p_shipment);
 update private.shipping_wallets set available_halalas=available_halalas-extra,reserved_halalas=reserved_halalas+extra,updated_at=now() where store_id=p_store and environment='sandbox';
 insert into private.shipping_ledger(store_id,environment,attempt_id,kind,reference,available_delta,reserved_delta,spent_delta) values(p_store,'sandbox',p_id,'RESERVE','cap-approval:'||p_id::text||':'||p_amount::text,-extra,extra,0);
 update private.shipping_attempts set quote_halalas=p_amount,approved_cap_halalas=p_amount,updated_at=now() where id=p_id;
 update private.oto_return_tests set cap_halalas=p_amount,updated_at=now() where id=p_id;
 insert into private.oto_return_test_events(attempt_id,stage) values(p_id,'CHARGE_INCREASE_APPROVED');
 return true;
end $$;
revoke all on function public.oto_return_test_approve_charge(uuid,uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.oto_return_test_approve_charge(uuid,uuid,uuid,integer,text) to service_role;
