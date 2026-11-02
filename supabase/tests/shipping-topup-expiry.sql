do $$
declare s uuid:=gen_random_uuid();u uuid:=gen_random_uuid();t jsonb;n jsonb;l uuid:=gen_random_uuid();c uuid:=gen_random_uuid();p uuid:=gen_random_uuid();i uuid:=gen_random_uuid();
begin
 insert into public.stores values(s);
 insert into public.memberships values(s,u,'owner');
 insert into public.store_billing values(s,'sandbox','premium','ACTIVE',now()-interval '1 day',now()+interval '1 month');
 perform public.test_shipping_assert(not has_function_privilege('authenticated','public.shipping_topup_retire_expired(uuid,uuid,uuid,uuid)','execute'),'no merchant expiry mutation');
 t:=public.shipping_topup_start(s,u,10000);
 perform public.shipping_topup_claim((t->>'id')::uuid,s);
 perform public.shipping_topup_bind((t->>'id')::uuid,s,c,p);
 perform public.shipping_topup_note_link((t->>'id')::uuid,s,l);
 perform public.shipping_topup_ready((t->>'id')::uuid,s,l,'https://streampay.sa/test');
 perform public.test_shipping_reject(format('select public.shipping_topup_retire_expired(%L,%L,%L,%L)',s,t->>'id',u,l));
 update private.shipping_topups set created_at=now()-interval '1 hour',expires_at=now()-interval '1 hour' where id=(t->>'id')::uuid;
 perform public.test_shipping_reject(format('select public.shipping_topup_retire_expired(%L,%L,%L,%L)',s,t->>'id',gen_random_uuid(),l));
 perform public.test_shipping_reject(format('select public.shipping_topup_retire_expired(%L,%L,%L,%L)',s,t->>'id',u,gen_random_uuid()));
 perform public.test_shipping_assert(public.shipping_topup_retire_expired(s,(t->>'id')::uuid,u,l),'retire expired');
 perform public.test_shipping_assert(not public.shipping_topup_retire_expired(s,(t->>'id')::uuid,u,l),'retire replay');
 perform public.test_shipping_assert((public.shipping_topup_by_link(l)->>'state')='EXPIRED_UNPAID','retained old lookup');
 n:=public.shipping_topup_start(s,u,25000);
 perform public.test_shipping_assert(n->>'id'<>t->>'id','new attempt allowed');
 perform public.test_shipping_assert((public.shipping_wallet_snapshot(s,'sandbox')->>'availableHalalas')::bigint=0,'expiry never grants funds');
 -- Delayed genuine provider success must still credit exactly once; never discard old references.
 perform public.test_shipping_assert(public.shipping_topup_complete((t->>'id')::uuid,i,l,c,p,10000),'late paid credit');
 perform public.test_shipping_assert(not public.shipping_topup_complete((t->>'id')::uuid,i,l,c,p,10000),'late paid replay');
 perform public.test_shipping_assert((public.shipping_topup_pending(s)->>'id')=n->>'id','newest attempt retained');
end $$;
