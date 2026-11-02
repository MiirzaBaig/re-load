do $$
declare s uuid:=gen_random_uuid();u uuid:=gen_random_uuid();a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();f text:=repeat('a',64);r jsonb;amount bigint;
begin
 insert into public.stores values(s);insert into public.memberships values(s,u,'owner');
 perform public.test_shipping_assert(not has_table_privilege('authenticated','private.oto_return_tests','select'),'private return test');
 perform public.test_shipping_assert(not has_function_privilege('authenticated','public.oto_return_test_claim(uuid,uuid,uuid,text)','execute'),'server-only claim');
 perform public.test_shipping_reject(format('select public.oto_return_test_prepare(%L,%L,%L,%L,''2828'',2500,3000)',a,s,u,f));
 insert into public.store_billing values(s,'sandbox','premium','ACTIVE',now()-interval '1 day',now()+interval '1 month');
 r:=public.oto_return_test_prepare(a,s,u,f,'2828',2500,3000);
 perform public.test_shipping_reject(format('select public.oto_return_test_claim(%L,%L,%L,%L)',s,a,u,f));
 perform public.test_shipping_assert(public.shipping_apply_verified_topup(s,'sandbox','OTO-TEST-'||s,10000),'test funded');
 -- Editing an unsubmitted draft replaces its fingerprint. Old tabs cannot claim it.
 r:=public.oto_return_test_prepare(a,s,u,repeat('b',64),'2828',2500,3000);
 perform public.test_shipping_reject(format('select public.oto_return_test_claim(%L,%L,%L,%L)',s,a,u,f));
 f:=repeat('b',64);
 perform public.test_shipping_assert(public.oto_return_test_claim(s,a,u,f),'one claim');
 perform public.test_shipping_assert(not public.oto_return_test_claim(s,a,u,f),'claim replay');
 perform public.test_shipping_assert((public.shipping_wallet_snapshot(s,'sandbox')->>'availableHalalas')::bigint=7000,'maximum reserved');
 perform public.test_shipping_assert((public.shipping_wallet_snapshot(s,'sandbox')->>'reservedHalalas')::bigint=3000,'reserved held');
 perform public.test_shipping_reject(format('select public.oto_return_test_prepare(%L,%L,%L,%L,''2828'',2500,3000)',b,s,u,f));
 perform public.test_shipping_reject(format('select public.oto_return_test_advance(%L,%L,''WAREHOUSE_CREATING'',''RETURN_SAVED'',''FOREIGN-R1'')',s,a));
 perform public.oto_return_test_advance(s,a,'WAREHOUSE_CREATING','WAREHOUSE_READY');
 perform public.oto_return_test_advance(s,a,'WAREHOUSE_READY','ORDER_CREATING');
 perform public.oto_return_test_advance(s,a,'ORDER_CREATING','ORDER_READY');
 perform public.oto_return_test_advance(s,a,'ORDER_READY','RETURN_CREATING');
 perform public.test_shipping_reject(format('select public.oto_return_test_advance(%L,%L,''RETURN_CREATING'',''RETURN_SAVED'',''FOREIGN-R1'')',s,a));
 perform public.oto_return_test_advance(s,a,'RETURN_CREATING','RETURN_SAVED','RLDTEST-'||replace(a::text,'-','')||'-R1');
 r:=public.oto_return_test_record(s,a);
 perform public.test_shipping_assert(jsonb_array_length(r->'events')=7,'durable stage history');
 perform public.test_shipping_assert(public.oto_return_test_record(gen_random_uuid(),a) is null,'foreign store read');
 perform public.shipping_note_provider_reference(a,s,'sandbox','SANDBOX-SHIP');
 perform public.shipping_finish_attempt(a,s,'sandbox','BOOKED',2500,'SANDBOX-SHIP','verified-test-charge');
 perform public.test_shipping_assert((public.shipping_wallet_snapshot(s,'sandbox')->>'availableHalalas')::bigint=7500,'unused cap released');
 perform public.test_shipping_assert((public.shipping_wallet_snapshot(s,'sandbox')->>'spentHalalas')::bigint=2500,'actual charge settled');
end $$;
