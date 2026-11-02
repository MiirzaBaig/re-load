do $$
declare s uuid:=gen_random_uuid();u uuid:=gen_random_uuid();a uuid:=gen_random_uuid();f text:=repeat('c',64);r jsonb;
begin
 insert into public.stores values(s);insert into public.memberships values(s,u,'owner');insert into public.store_billing values(s,'sandbox','premium','ACTIVE',now()-interval '1 day',now()+interval '1 month');
 perform public.shipping_apply_verified_topup(s,'sandbox','ASYNC-TEST-'||s,10000);
 perform public.oto_return_test_prepare(a,s,u,f,'2828',3421,5000);
 perform public.oto_return_test_claim(s,a,u,f);
 perform public.oto_return_test_advance(s,a,'WAREHOUSE_CREATING','WAREHOUSE_READY');perform public.oto_return_test_advance(s,a,'WAREHOUSE_READY','ORDER_CREATING');perform public.oto_return_test_advance(s,a,'ORDER_CREATING','ORDER_READY');perform public.oto_return_test_advance(s,a,'ORDER_READY','RETURN_CREATING');
 perform public.oto_return_test_advance(s,a,'RETURN_CREATING','RETURN_REQUESTED');
 perform public.oto_return_test_advance(s,a,'RETURN_REQUESTED','RETURN_SAVED','RLDTEST-'||replace(a::text,'-',''));
 perform public.shipping_note_provider_reference(a,s,'sandbox','TEST-ASYNC');
 perform public.test_shipping_reject(format('select public.shipping_finish_attempt(%L,%L,''sandbox'',''BOOKED'',6842,''TEST-ASYNC'',''recorded-charge'')',a,s));
 perform public.test_shipping_reject(format('select public.oto_return_test_approve_charge(%L,%L,%L,6842,''FOREIGN'')',s,a,u));
 perform public.test_shipping_reject(format('select public.oto_return_test_approve_charge(%L,%L,%L,6842,''TEST-ASYNC'')',s,a,gen_random_uuid()));
 perform public.test_shipping_assert(not has_function_privilege('authenticated','public.oto_return_test_approve_charge(uuid,uuid,uuid,integer,text)','execute'),'approval service only');
 perform public.test_shipping_assert(public.oto_return_test_approve_charge(s,a,u,6842,'TEST-ASYNC'),'explicit approval');
 perform public.test_shipping_assert(not public.oto_return_test_approve_charge(s,a,u,6842,'TEST-ASYNC'),'approval replay');
 perform public.test_shipping_assert((public.shipping_wallet_snapshot(s,'sandbox')->>'availableHalalas')::bigint=3158,'extra amount reserved once');
 perform public.shipping_finish_attempt(a,s,'sandbox','BOOKED',6842,'TEST-ASYNC','recorded-charge');
 perform public.test_shipping_assert((public.shipping_wallet_snapshot(s,'sandbox')->>'reservedHalalas')::bigint=0,'reservation settled');
 perform public.test_shipping_assert((public.shipping_wallet_snapshot(s,'sandbox')->>'spentHalalas')::bigint=6842,'exact actual cost');
 perform public.test_shipping_assert((select count(*) from private.oto_test_charge_approvals where attempt_id=a and actor_user_id=u)=1,'approval actor recorded');
end $$;
