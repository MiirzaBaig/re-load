-- Run after billing migrations inside a test database; all writes roll back.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.stores(id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.memberships values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','owner'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','owner');
select set_config('test.auth_role','service_role',true);
update public.billing_settings set enforcement_enabled=true;
do $$declare c public.billing_checkouts; r uuid; used integer; snap jsonb; failed boolean; begin
 -- Sandbox payment does not activate production.
 c:=public.billing_start_checkout('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','sandbox','11111111-1111-4111-8111-111111111111','premium');
 update public.billing_checkouts set status='READY',consumer_id='11111111-1111-4111-8111-111111111111' where id=c.id;
 perform public.billing_apply_invoice(c.id,'33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444',now()-interval '1 day',now()+interval '29 days');
 failed:=false;begin perform public.billing_reserve_message(c.store_id,'sandbox-must-not-unlock');exception when others then failed:=sqlerrm='subscription_required';end;
 if not failed then raise exception 'Sandbox unlocked live assistant';end if;
 -- Live paid cycle, invoice dedupe and reservations.
 c:=public.billing_start_checkout(c.store_id,'live',c.user_id,'standard');
 update public.billing_checkouts set status='READY',consumer_id='11111111-1111-4111-8111-111111111111' where id=c.id;
 perform public.billing_apply_invoice(c.id,'55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666',date_trunc('day',now())-interval '1 day',date_trunc('day',now())+interval '29 days');
 perform public.billing_apply_invoice(c.id,'55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666',date_trunc('day',now())-interval '1 day',date_trunc('day',now())+interval '29 days');
 if (select count(*) from public.billing_payments where environment='live')<>1 then raise exception 'Duplicate invoice credited';end if;
 r:=public.billing_reserve_message(c.store_id,'message-one');
 if public.billing_reserve_message(c.store_id,'message-one')<>r then raise exception 'Reservation not idempotent';end if;
 -- Early delivery callback is applied once the receipt is linked.
 perform public.billing_settle_message('wamid.test','DELIVERED');
 update public.billing_message_usage set external_message_id='wamid.test' where id=r;
 if (select state from public.billing_message_usage where id=r)<>'DELIVERED' then raise exception 'Early delivery lost';end if;
 perform public.billing_settle_message('wamid.test','FAILED');
 if (select state from public.billing_message_usage where id=r)<>'DELIVERED' then raise exception 'Status regressed';end if;
 -- Last allowance cannot be overspent; failed send releases capacity.
 insert into public.billing_message_usage(store_id,message_key,period_start,bucket,state)
 select c.store_id,'fill-'||i,b.period_start,'INCLUDED','DELIVERED' from generate_series(1,499)i join public.store_billing b on b.store_id=c.store_id and b.environment='live';
 failed:=false;begin perform public.billing_reserve_message(c.store_id,'over-limit');exception when others then failed:=sqlerrm='upgrade_required';end;
 if not failed then raise exception 'Standard exceeded allowance';end if;
 update public.billing_message_usage set state='FAILED' where message_key='fill-1';
 perform public.billing_reserve_message(c.store_id,'after-failure');
 -- Subscription upgrade records prorated entitlement without resetting the cycle.
 c:=public.billing_start_checkout(c.store_id,'live',c.user_id,'premium','UPGRADE');
 if c.amount_halalas not between 100 and 15000 or c.upgrade_messages not between 1 and 1500 then raise exception 'Invalid upgrade quote';end if;
 update public.billing_checkouts set status='READY' where id=c.id;
 perform public.billing_apply_invoice(c.id,'77777777-7777-4777-8777-777777777777',null,null,null);
 if (select plan from public.store_billing where store_id=c.store_id and environment='live')<>'premium' then raise exception 'Upgrade not applied';end if;
 -- A replayed Standard invoice must not downgrade an already-paid Premium upgrade.
 perform public.billing_apply_invoice((select id from public.billing_checkouts where kind='SUBSCRIPTION' and environment='live' and store_id=c.store_id),'55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666',date_trunc('day',now())-interval '1 day',date_trunc('day',now())+interval '29 days');
 if (select plan from public.store_billing where store_id=c.store_id and environment='live')<>'premium' then raise exception 'Replayed invoice downgraded plan';end if;
 -- Purchased credits carry over and duplicates do not mint credits twice.
 insert into public.billing_bundle_credits values(c.store_id,'live','88888888-8888-4888-8888-888888888888',2000) on conflict do nothing;
 insert into public.billing_bundle_credits values(c.store_id,'live','88888888-8888-4888-8888-888888888888',2000) on conflict do nothing;
 if (select sum(purchased) from public.billing_bundle_credits where store_id=c.store_id)<>2000 then raise exception 'Duplicate purchased credit';end if;
 update public.store_billing set period_start=now(),period_end=now()+interval '30 days',included_override=null where store_id=c.store_id and environment='live';
 snap:=public.billing_snapshot(c.store_id,'live');
 if (snap->>'used')::int<>0 or (snap->>'purchasedRemaining')::int<>2000 then raise exception 'Carryover or cycle reset broken';end if;
 -- Ordinary merchant cannot read another store's billing.
 perform set_config('test.auth_role','authenticated',true);perform set_config('test.user_id','22222222-2222-4222-8222-222222222222',true);
 failed:=false;begin perform public.billing_snapshot(c.store_id,'live');exception when others then failed:=sqlerrm='insufficient_permission';end;
 if not failed then raise exception 'Cross-store billing leak';end if;
 raise notice 'PASS: sandbox isolation, invoice dedupe, reservation dedupe, callback race, monotonic status, allowance lock, failed send release, prorated upgrade, carryover and tenant isolation';
end $$;
rollback;
