-- Runs only in an isolated temporary database. Synthetic funds, no provider/network.
create function public.test_shipping_assert(p boolean,p_message text) returns void language plpgsql as $$ begin if p is not true then raise exception 'assertion: %',p_message;end if;end $$;
create function public.test_shipping_reject(p_sql text) returns void language plpgsql as $$
begin
 begin execute p_sql;exception when others then return;end;
 raise exception 'expected rejection: %',p_sql;
end $$;
insert into public.stores values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.memberships values('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner');
insert into public.return_cases values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','OPEN'),('cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222222','OPEN');

do $$
declare a uuid:='11111111-1111-4111-8111-111111111111';b uuid:='22222222-2222-4222-8222-222222222222';
 wh uuid; whb uuid; id uuid:='dddddddd-dddd-4ddd-8ddd-dddddddddddd'; id2 uuid:='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 expiry timestamptz:=now()+interval '10 minutes'; before jsonb; after jsonb; result jsonb; count_before bigint;
begin
 -- Actual privileges, not just role-aware function branches.
 perform public.test_shipping_assert(not has_function_privilege('anon','public.shipping_wallet_snapshot(uuid,text)','execute'),'anon read');
 perform public.test_shipping_assert(not has_function_privilege('authenticated','public.shipping_apply_verified_topup(uuid,text,text,integer)','execute'),'merchant credit');
 perform public.test_shipping_assert(not has_function_privilege('authenticated','public.shipping_finish_attempt(uuid,uuid,text,text,integer,text,text)','execute'),'merchant settlement');
 perform public.test_shipping_assert(not has_table_privilege('authenticated','private.shipping_wallets','select'),'raw wallet');
 perform public.test_shipping_assert(not has_function_privilege('authenticated','public.shipping_attempt_record(uuid,uuid,text)','execute'),'private server read');
 perform public.test_shipping_assert(not has_sequence_privilege('authenticated','private.shipping_ledger_id_seq','usage'),'private sequence');
 perform public.test_shipping_assert(not has_table_privilege('service_role','private.shipping_ledger','insert'),'raw service insert');
 perform public.test_shipping_reject(format('select public.shipping_apply_verified_topup(%L,''live'',''payment-1'',10000)',a));
 wh:=public.shipping_register_warehouse(a,'sandbox','TEST-WAREHOUSE-A');
 whb:=public.shipping_register_warehouse(b,'sandbox','TEST-WAREHOUSE-B');
 perform public.test_shipping_assert(wh=public.shipping_register_warehouse(a,'sandbox','TEST-WAREHOUSE-A'),'warehouse replay');
 perform public.test_shipping_reject(format('select public.shipping_register_warehouse(%L,''sandbox'',''TEST-WAREHOUSE-A'')',b));
 perform public.test_shipping_assert(public.shipping_apply_verified_topup(a,'sandbox','stream-payment-1',10000),'credit');
 perform public.test_shipping_assert(not public.shipping_apply_verified_topup(a,'sandbox','stream-payment-1',10000),'payment replay');
 perform public.test_shipping_reject(format('select public.shipping_apply_verified_topup(%L,''sandbox'',''stream-payment-1'',10001)',a));
 perform public.test_shipping_reject(format('select public.shipping_apply_verified_topup(%L,''sandbox'',''stream-payment-1'',10000)',b));
 perform public.test_shipping_reject(format('select public.shipping_apply_verified_topup(%L,''sandbox'',''bad@example.com'',100)',a));
 perform public.test_shipping_reject(format('select public.shipping_apply_verified_topup(%L,''sandbox'',''negative'',-100)',a));
 perform public.test_shipping_reject(format('select public.shipping_reserve_attempt(%L,%L,''sandbox'',%L,null,3000,2000,%L)',id,a,wh,expiry));
 perform public.test_shipping_reject(format('select public.shipping_reserve_attempt(%L,%L,''sandbox'',%L,null,3000,3000,%L)',id,a,whb,expiry));
 perform public.test_shipping_reject(format('select public.shipping_reserve_attempt(%L,%L,''sandbox'',%L,%L,3000,3000,%L)',id,a,wh,'cccccccc-cccc-4ccc-8ccc-cccccccccccc',expiry));
 perform public.test_shipping_reject(format('select public.shipping_reserve_attempt(%L,%L,''sandbox'',%L,null,3000,3000,%L)',id,a,wh,now()-interval '1 minute'));
 perform public.test_shipping_reject(format('select public.shipping_reserve_attempt(%L,%L,''sandbox'',%L,null,10001,10001,%L)',id,a,wh,expiry));
 result:=public.shipping_reserve_attempt(id,a,'sandbox',wh,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',3000,4000,expiry);
 perform public.test_shipping_assert((result->>'claimed')::boolean,'reservation');
 perform public.test_shipping_assert(not(public.shipping_reserve_attempt(id,a,'sandbox',wh,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',3000,4000,expiry)->>'claimed')::boolean,'reserve replay');
 perform public.test_shipping_reject(format('select public.shipping_reserve_attempt(%L,%L,''sandbox'',%L,null,3000,4000,%L)',id,b,whb,expiry));
 perform public.test_shipping_reject(format('select public.shipping_reserve_attempt(%L,%L,''sandbox'',%L,%L,3000,4000,%L)',id2,a,wh,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',expiry));
 perform set_config('test.uid','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
 result:=public.shipping_wallet_snapshot(a,'sandbox');
 perform public.test_shipping_assert((result->>'availableHalalas')::bigint=7000 and (result->>'reservedHalalas')::bigint=3000,'reserve balances');
 perform public.test_shipping_assert((public.shipping_wallet_snapshot(a,'live')->>'availableHalalas')::bigint=0,'namespace isolation');
 perform public.test_shipping_assert(result::text !~ '(provider_order_ref|provider_shipment_ref|payment-1|TEST-WAREHOUSE|customer|address|token)','snapshot privacy');
 perform public.test_shipping_assert(public.shipping_claim_submission(id,a,'sandbox'),'claim');
 perform public.test_shipping_assert(not public.shipping_claim_submission(id,a,'sandbox'),'claim replay');
 perform public.test_shipping_assert(public.shipping_note_provider_reference(id,a,'sandbox','SHIP-A'),'reference retained');
 perform public.test_shipping_assert(not public.shipping_note_provider_reference(id,a,'sandbox','SHIP-A'),'reference replay');
 perform public.test_shipping_reject(format('select public.shipping_note_provider_reference(%L,%L,''sandbox'',''SHIP-B'')',id,a));
 perform public.test_shipping_assert(public.shipping_attempt_record(id,b,'sandbox') is null,'foreign server lookup');
 perform public.test_shipping_assert(public.shipping_attempt_record(id,a,'sandbox')->>'providerShipmentRef'='SHIP-A','reference read');
 perform public.test_shipping_assert(public.shipping_finish_attempt(id,a,'sandbox','UNKNOWN'),'unknown');
 perform public.test_shipping_reject(format('select public.shipping_finish_attempt(%L,%L,''sandbox'',''FAILED'')',id,a));
 perform public.test_shipping_reject(format('select public.shipping_finish_attempt(%L,%L,''sandbox'',''FAILED'',null,null,''support-no-create'')',id,a));
 perform public.test_shipping_reject(format('select public.shipping_reserve_attempt(%L,%L,''sandbox'',%L,null,100,100,%L)',id2,a,wh,expiry));
 perform public.test_shipping_reject(format('select public.shipping_finish_attempt(%L,%L,''sandbox'',''BOOKED'',3100,''SHIP-A'',''OTO-CHARGE-A'')',id,a));
 perform public.test_shipping_assert(public.shipping_finish_attempt(id,a,'sandbox','BOOKED',2500,'SHIP-A','OTO-CHARGE-A'),'settled');
 perform public.test_shipping_assert(not public.shipping_finish_attempt(id,a,'sandbox','BOOKED',2500,'SHIP-A','OTO-CHARGE-A'),'settlement replay');
 perform public.test_shipping_reject(format('select public.shipping_finish_attempt(%L,%L,''sandbox'',''BOOKED'',2499,''SHIP-A'',''OTO-CHARGE-A'')',id,a));
 result:=public.shipping_wallet_snapshot(a,'sandbox');
 perform public.test_shipping_assert((result->>'availableHalalas')::bigint=7500 and (result->>'reservedHalalas')::bigint=0 and (result->>'spentHalalas')::bigint=2500,'settled balances');
 perform public.test_shipping_assert(public.shipping_apply_provider_credit(id,a,'sandbox','credit-a',1000),'credit');
 perform public.test_shipping_assert(not public.shipping_apply_provider_credit(id,a,'sandbox','credit-a',1000),'credit replay');
 perform public.test_shipping_reject(format('select public.shipping_apply_provider_credit(%L,%L,''sandbox'',''credit-a'',999)',id,a));
 perform public.test_shipping_reject(format('select public.shipping_apply_provider_credit(%L,%L,''sandbox'',''credit-too-large'',1501)',id,a));
 perform public.test_shipping_assert(public.shipping_apply_provider_credit(id,a,'sandbox','credit-b',1500,true),'remaining credit');
 result:=public.shipping_wallet_snapshot(a,'sandbox');
 perform public.test_shipping_assert((result->>'availableHalalas')::bigint=10000 and (result->>'spentHalalas')::bigint=0,'credited balances');
 perform public.test_shipping_assert((select state='CANCELLED' from private.shipping_attempts x where x.id=id2) is null,'no phantom booking');
 -- Definite failure before submission releases funds exactly once.
 perform public.shipping_reserve_attempt(id2,a,'sandbox',wh,null,2000,2000,expiry);
 perform public.test_shipping_assert(public.shipping_finish_attempt(id2,a,'sandbox','FAILED'),'prewrite failure');
 perform public.test_shipping_assert(not public.shipping_finish_attempt(id2,a,'sandbox','FAILED'),'release replay');
 perform public.test_shipping_assert((public.shipping_wallet_snapshot(a,'sandbox')->>'availableHalalas')::bigint=10000,'released funds');
 -- Immutability and tenant checks.
 perform public.test_shipping_reject('update private.shipping_ledger set available_delta=0');
 perform public.test_shipping_reject('delete from private.shipping_ledger');
 perform public.test_shipping_reject('delete from private.shipping_attempt_events');
 perform public.test_shipping_reject(format('select public.shipping_wallet_snapshot(%L,''sandbox'')',b));
 perform set_config('test.uid','99999999-9999-4999-8999-999999999999',true);
 perform set_config('test.staff_role','viewer',true);
 perform public.test_shipping_reject(format('select public.shipping_wallet_snapshot(%L,''sandbox'')',a));
 perform set_config('test.staff_role','owner',true);perform set_config('test.mfa','no',true);
 perform public.test_shipping_reject(format('select public.shipping_wallet_snapshot(%L,''sandbox'')',a));
 perform set_config('test.mfa','yes',true);
 result:=public.shipping_wallet_snapshot(a,'sandbox');
 perform public.test_shipping_assert((result->>'availableHalalas')::bigint=10000,'owner read');
 perform public.test_shipping_assert(exists(select 1 from public.platform_admin_events where event_type='SHIPPING_WALLET_VIEWED'),'owner audit');
 -- Ledger and cache are conserved.
 perform public.test_shipping_assert(not exists(select 1 from private.shipping_wallets w where w.available_halalas<>(select coalesce(sum(available_delta),0) from private.shipping_ledger e where e.store_id=w.store_id and e.environment=w.environment) or w.reserved_halalas<>(select coalesce(sum(reserved_delta),0) from private.shipping_ledger e where e.store_id=w.store_id and e.environment=w.environment) or w.spent_halalas<>(select coalesce(sum(spent_delta),0) from private.shipping_ledger e where e.store_id=w.store_id and e.environment=w.environment)),'ledger conservation');
end $$;
