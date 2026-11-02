-- Bound failed transport recovery too, without discarding input before a normal reply commit.
alter table private.whatsapp_inbox add column collection_sensitive boolean not null default false;
create function public.shipping_collection_mark_transport(p_message text,p_conversation uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update private.whatsapp_inbox i set collection_sensitive=true
 where i.id=p_message and i.status='PROCESSING' and exists(
  select 1 from public.whatsapp_conversations v join public.whatsapp_contacts c on c.id=v.contact_id and c.store_id=v.store_id
  where v.id=p_conversation and c.wa_id=i.sender);
 if not found then raise exception 'inbox_lease_missing';end if;
end $$;
revoke all on function public.shipping_collection_mark_transport(text,uuid) from public,anon,authenticated;
grant execute on function public.shipping_collection_mark_transport(text,uuid) to service_role;
create or replace function public.shipping_collection_purge() returns void language plpgsql security definer set search_path='' as $$
begin
 update private.shipping_collection_confirmations set ciphertext=null,state='EXPIRED' where expires_at<=now() and ciphertext is not null;
 update private.whatsapp_flow_state set context=context-'collection' where (context->'collection'->>'expiresAt')::numeric<extract(epoch from now())*1000;
 update private.whatsapp_flow_state set context=jsonb_set(context,'{returnResume,context}',(context#>'{returnResume,context}')-'collection') where (context#>>'{returnResume,context,collection,expiresAt}')::numeric<extract(epoch from now())*1000;
 update private.whatsapp_inbox set message=jsonb_build_object('id',message->'id','from',message->'from','type','text','timestamp',message->'timestamp','text',jsonb_build_object('body','[Expired return collection input hidden]'))
 where collection_sensitive and created_at<now()-interval '24 hours' and message->'text'->>'body' is distinct from '[Expired return collection input hidden]';
end $$;
