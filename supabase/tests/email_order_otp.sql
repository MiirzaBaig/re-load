begin;
do $$
<<email_order_otp>>
declare s uuid:=gen_random_uuid();ct uuid; cv uuid; cv2 uuid; id uuid:=gen_random_uuid(); id2 uuid:=gen_random_uuid(); r jsonb;
begin
 insert into public.stores(id,name) values(s,'OTP rollback test');
 insert into public.whatsapp_contacts(store_id,wa_id) values(s,'otp-test-only') returning whatsapp_contacts.id into ct;
 insert into public.whatsapp_conversations(store_id,contact_id) values(s,ct) returning whatsapp_conversations.id into cv;
 insert into public.whatsapp_conversations(store_id,contact_id) values(s,ct) returning whatsapp_conversations.id into cv2;
 assert not has_function_privilege('anon','public.verify_order_email_otp(uuid,uuid,text,text,text)','execute'),'no anonymous OTP checks';
 assert not has_function_privilege('authenticated','public.get_order_email_grant(uuid,uuid,text)','execute'),'no browser identity grants';
 assert not has_table_privilege('authenticated','private.order_email_challenges','select'),'private OTP data';
 r:=public.prepare_order_email_otp(id,cv,'ORDER-1','test-otp-message','recipient','correct-hash','encrypted-delivery','encrypted-email');
 assert r->>'status'='PREPARED','reserved before sending';
 assert public.verify_order_email_otp(id,cv,'ORDER-1','correct-hash','code-1')->>'status'='expired','cannot verify unsent code';
 assert public.finish_order_email_otp(id,cv,true,'provider-id'),'provider accepted';
 assert public.prepare_order_email_otp(id2,cv,'ORDER-1','test-otp-message','recipient','different','x','x')->>'id'=id::text,'duplicate send reuses challenge';
 assert public.prepare_order_email_otp(id2,cv,'ORDER-1','test-otp-new-message','recipient','different','x','x')->>'status'='cooldown','resend cooldown';
 assert public.verify_order_email_otp(id,cv2,'ORDER-1','correct-hash','code-1')->>'status'='expired','conversation isolation';
 assert public.verify_order_email_otp(id,cv,'OTHER','correct-hash','code-1')->>'status'='expired','order isolation';
 assert public.verify_order_email_otp(id,cv,'ORDER-1','wrong','wrong-1')->>'status'='invalid','wrong code rejected';
 perform public.verify_order_email_otp(id,cv,'ORDER-1','wrong','wrong-1');
 assert not exists(select 1 from private.order_email_challenges t where t.id=email_order_otp.id2),'unused challenge absent';
 assert (select attempts from private.order_email_challenges where order_email_challenges.id=email_order_otp.id)=1,'duplicate inbound attempt counted once';
 assert public.verify_order_email_otp(id,cv,'ORDER-1','correct-hash','right-1')->>'status'='verified','correct code accepted';
 assert public.verify_order_email_otp(id,cv,'ORDER-1','correct-hash','right-1')->>'status'='verified','successful worker replay';
 assert public.verify_order_email_otp(id,cv,'ORDER-1','correct-hash','right-2')->>'status'='expired','single-use code';
 assert public.get_order_email_grant(id,cv,'ORDER-1')='encrypted-email','private recovery grant';
 assert public.get_order_email_grant(id,cv2,'ORDER-1') is null,'recovery cannot cross conversations';
 update private.order_email_challenges set created_at=now()-interval '61 seconds' where order_email_challenges.id=email_order_otp.id;
 r:=public.prepare_order_email_otp(id2,cv,'ORDER-1','test-otp-new-message','recipient','second-hash','x','y');
 perform public.finish_order_email_otp(id2,cv,true,'provider-id-2');
 for i in 1..5 loop r:=public.verify_order_email_otp(id2,cv,'ORDER-1','wrong','bad-'||i); end loop;
 assert r->>'status'='locked','five attempts lock challenge';
 assert public.verify_order_email_otp(id2,cv,'ORDER-1','second-hash','late-right')->>'status'='locked','locked even with right code';
 update private.order_email_challenges set attempts=0,expires_at=now()-interval '1 second' where order_email_challenges.id=email_order_otp.id2;
 assert public.verify_order_email_otp(id2,cv,'ORDER-1','second-hash','expired-right')->>'status'='expired','expiry enforced';
end $$;
rollback;
