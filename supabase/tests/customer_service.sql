-- Isolated fixtures; rolls back data and queued network jobs.
begin;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();owner_id uuid;contact uuid;conversation uuid;ticket uuid;rid uuid:=gen_random_uuid();message_id text;
begin
 select id into owner_id from auth.users limit 1;
 assert owner_id is not null,'one existing auth user required';
 insert into public.stores(id,name)values(a,'Service test A'),(b,'Service test B');
 insert into public.memberships(store_id,user_id,role)values(a,owner_id,'owner');
 insert into public.whatsapp_connections(store_id,phone_number_id,business_account_id,status)values(a,'service-test-phone','service-test-waba','CONNECTED');
 insert into public.whatsapp_contacts(store_id,wa_id)values(a,'966500000000')returning id into contact;
 insert into public.whatsapp_conversations(store_id,contact_id,service_window_expires_at)values(a,contact,now()+interval '1 hour')returning id into conversation;
 ticket:=public.create_support_ticket(a,conversation,'service-ticket-fixture','COMPLAINT','Delivery question');
 assert public.create_support_ticket(a,conversation,'service-ticket-fixture','COMPLAINT','Delivery question')=ticket,'idempotent ticket';
 begin
  perform public.create_support_ticket(b,conversation,'bad-fixture','QUESTION','Cross-store question');
  raise exception 'cross-store ticket accepted';
 exception when others then assert sqlerrm='conversation_mismatch','conversation scoped to store';end;
 begin
  perform public.queue_staff_whatsapp_reply(a,conversation,rid,gen_random_uuid(),'service-test-phone','Hello');
  raise exception 'unauthorized reply accepted';
 exception when others then assert sqlerrm='insufficient_permission','staff role required';end;
 message_id:=public.queue_staff_whatsapp_reply(a,conversation,rid,owner_id,'service-test-phone','Hello');
 assert public.queue_staff_whatsapp_reply(a,conversation,rid,owner_id,'service-test-phone','Hello')=message_id,'idempotent reply';
 assert(select count(*) from private.whatsapp_inbox where id=message_id)=1,'one queued send';
 assert(select state='HANDED_TO_HUMAN' from public.whatsapp_conversations where id=conversation),'reply pauses assistant';
 update public.whatsapp_conversations set service_window_expires_at=now()-interval '1 minute' where id=conversation;
 begin
  perform public.queue_staff_whatsapp_reply(a,conversation,gen_random_uuid(),owner_id,'service-test-phone','Late reply');
  raise exception 'outside-window reply accepted';
 exception when others then assert sqlerrm='service_window_closed','free-text window enforced';end;
 assert not has_function_privilege('authenticated','public.queue_staff_whatsapp_reply(uuid,uuid,uuid,uuid,text,text)','EXECUTE'),'service-only reply RPC';
 assert not has_table_privilege('anon','public.store_knowledge','SELECT'),'knowledge not public';
 assert not has_table_privilege('authenticated','public.store_knowledge','UPDATE'),'publishing via guarded backend only';
 insert into public.store_knowledge(store_id,title,content,category,language,published,approved_by)values(a,'Delivery','Three days','DELIVERY','en',true,owner_id);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 set local role authenticated;
 assert(select count(*)from public.store_knowledge where store_id=a)=1,'member reads own knowledge';
 assert(select count(*)from public.store_knowledge where store_id=b)=0,'other store knowledge inaccessible';
 reset role;
 perform public.apply_salla_resource_event(a,'service-event-1','product.price.updated','digest','product','123','{"price":100}',false,now());
 perform public.apply_salla_resource_event(a,'service-event-2','product.price.updated','digest','product','123','{"price":50}',false,now()-interval '1 day');
 assert(select snapshot->>'price'='100' from public.commerce_resource_changes where store_id=a and resource_id='123'),'out-of-order webhook cannot overwrite newer facts';
 perform public.apply_salla_resource_event(a,'service-event-1','product.price.updated','digest','product','123','{"price":999}',false,now());
 assert(select snapshot->>'price'='100' from public.commerce_resource_changes where store_id=a and resource_id='123'),'duplicate webhook has no effect';
end $$;
rollback;
