-- Approved store knowledge and customer-service tickets. Existing store RLS stays intact.
create table public.store_knowledge (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 160),
 content text not null check(length(trim(content)) between 1 and 6000),
 category text not null check(category in ('FAQ','DELIVERY','WARRANTY','SUPPORT')),
 language text not null default 'ar' check(language in ('ar','en')),
 published boolean not null default false, approved_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(not published or approved_by is not null)
);
create index store_knowledge_store_idx on public.store_knowledge(store_id,published);
alter table public.store_knowledge enable row level security;
revoke all on public.store_knowledge from anon,authenticated;
grant select on public.store_knowledge to authenticated;
create policy "members read knowledge" on public.store_knowledge for select to authenticated using(private.is_store_member(store_id));

create table public.support_tickets (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
 conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
 source_message_id text not null unique, kind text not null check(kind in ('QUESTION','COMPLAINT','HUMAN')),
 message text not null check(length(message) between 1 and 4096),
 status text not null default 'OPEN' check(status in ('OPEN','IN_PROGRESS','RESOLVED')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index support_tickets_store_idx on public.support_tickets(store_id,status,created_at desc);
alter table public.support_tickets enable row level security;
revoke all on public.support_tickets from anon,authenticated;
grant select on public.support_tickets to authenticated;
create policy "members read tickets" on public.support_tickets for select to authenticated using(private.is_store_member(store_id));

create function public.create_support_ticket(p_store uuid,p_conversation uuid,p_message_id text,p_kind text,p_message text)
returns uuid language plpgsql security definer set search_path='' as $$
declare ticket_id uuid;
begin
 if not exists(select 1 from public.whatsapp_conversations where id=p_conversation and store_id=p_store) then raise exception 'conversation_mismatch'; end if;
 insert into public.support_tickets(store_id,conversation_id,source_message_id,kind,message)
 values(p_store,p_conversation,p_message_id,p_kind,left(p_message,4096)) on conflict(source_message_id) do nothing returning id into ticket_id;
 if ticket_id is null then select id into ticket_id from public.support_tickets where source_message_id=p_message_id and store_id=p_store and conversation_id=p_conversation; end if;
 if ticket_id is null then raise exception 'ticket_mismatch'; end if;
 return ticket_id;
end $$;
revoke all on function public.create_support_ticket(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.create_support_ticket(uuid,uuid,text,text,text) to service_role;

-- Staff replies reuse the durable inbox and its confirmed-receipt/uncertainty handling.
create function public.queue_staff_whatsapp_reply(p_store uuid,p_conversation uuid,p_id uuid,p_actor uuid,p_phone text,p_body text)
returns text language plpgsql security definer set search_path='' as $$
declare conv public.whatsapp_conversations; recipient text; message_id text := 'staff:'||p_id::text;
begin
 if length(trim(p_body)) not between 1 and 4096 then raise exception 'invalid_reply'; end if;
 if not exists(select 1 from public.memberships where store_id=p_store and user_id=p_actor and role in ('owner','admin')) then raise exception 'insufficient_permission'; end if;
 select * into conv from public.whatsapp_conversations where id=p_conversation and store_id=p_store for update;
 if conv.id is null then raise exception 'conversation_not_found'; end if;
 if exists(select 1 from private.whatsapp_inbox where id=message_id) then return message_id; end if;
 if conv.service_window_expires_at is null or conv.service_window_expires_at<=now() then raise exception 'service_window_closed'; end if;
 if not exists(select 1 from public.whatsapp_connections where store_id=p_store and phone_number_id=p_phone and status='CONNECTED') then raise exception 'channel_disconnected'; end if;
 select wa_id into recipient from public.whatsapp_contacts where id=conv.contact_id and store_id=p_store;
 update public.whatsapp_conversations set state='HANDED_TO_HUMAN',updated_at=now() where id=conv.id;
 insert into private.whatsapp_inbox(id,phone_id,sender,message,reply)
 values(message_id,p_phone,recipient,jsonb_build_object('id',message_id,'from',recipient,'type','staff_reply'),
 jsonb_build_object('plan',jsonb_build_object('kind','text','to',recipient,'body',trim(p_body)),'storeId',p_store,'conversationId',p_conversation));
 insert into public.integration_events(store_id,provider,external_event_id,event_type,payload_digest,status)
 values(p_store,'whatsapp',message_id,'STAFF_REPLY:'||p_conversation::text,'stored_privately','RECEIVED');
 insert into public.audit_events(store_id,actor_user_id,event_type,entity_type,entity_id) values(p_store,p_actor,'support.reply.queued','whatsapp_conversation',p_conversation);
 perform private.dispatch_whatsapp_inbox();
 return message_id;
end $$;
revoke all on function public.queue_staff_whatsapp_reply(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.queue_staff_whatsapp_reply(uuid,uuid,uuid,uuid,text,text) to service_role;

-- Safe resource-change snapshots; live order lookups remain authoritative.
create table public.commerce_resource_changes (
 store_id uuid not null references public.stores(id) on delete cascade,
 platform text not null check(platform='salla'), resource_type text not null check(resource_type in ('order','product')),
 resource_id text not null, deleted boolean not null default false,
 snapshot jsonb not null default '{}'::jsonb, changed_at timestamptz not null,
 primary key(store_id,platform,resource_type,resource_id)
);
alter table public.commerce_resource_changes enable row level security;
revoke all on public.commerce_resource_changes from anon,authenticated;
grant select on public.commerce_resource_changes to authenticated;
create policy "members read commerce changes" on public.commerce_resource_changes for select to authenticated using(private.is_store_member(store_id));

create function public.apply_salla_resource_event(p_store uuid,p_event_id text,p_event text,p_digest text,p_resource_type text,p_resource_id text,p_snapshot jsonb,p_deleted boolean,p_changed_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.integration_events(store_id,provider,external_event_id,event_type,payload_digest,status,attempts,processed_at)
 values(p_store,'salla',p_event_id,p_event,p_digest,'PROCESSED',1,now()) on conflict(provider,external_event_id) do nothing;
 if not found then return; end if;
 insert into public.commerce_resource_changes(store_id,platform,resource_type,resource_id,snapshot,deleted,changed_at)
 values(p_store,'salla',p_resource_type,p_resource_id,p_snapshot,p_deleted,p_changed_at)
 on conflict(store_id,platform,resource_type,resource_id) do update
 set snapshot=public.commerce_resource_changes.snapshot||excluded.snapshot,deleted=excluded.deleted,changed_at=excluded.changed_at
 where excluded.changed_at>=public.commerce_resource_changes.changed_at;
end $$;
revoke all on function public.apply_salla_resource_event(uuid,text,text,text,text,text,jsonb,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_salla_resource_event(uuid,text,text,text,text,text,jsonb,boolean,timestamptz) to service_role;

create function private.dispatch_salla_maintenance() returns void language plpgsql security definer set search_path='' as $$
declare ticket uuid:=gen_random_uuid();
begin
 if not exists(select 1 from private.commerce_credentials cr join public.commerce_connections co on co.id=cr.connection_id where co.platform='salla' and co.status='CONNECTED' and co.token_expires_at<now()+interval '2 days') then return; end if;
 insert into private.whatsapp_worker_tickets values(ticket,now()+interval '5 minutes');
 perform net.http_post(url:='https://clwczcvxosudfevjznmk.supabase.co/functions/v1/salla-maintenance',headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('ticket',ticket),timeout_milliseconds:=60000);
exception when others then raise warning 'salla maintenance dispatch failed';
end $$;
revoke all on function private.dispatch_salla_maintenance() from public,anon,authenticated;
select cron.schedule('reload-salla-token-renewal','17 * * * *','select private.dispatch_salla_maintenance()');

create function public.salla_stores_due_refresh()
returns table(store_id uuid) language sql security definer set search_path='' as $$
 select co.store_id from public.commerce_connections co join private.commerce_credentials cr on cr.connection_id=co.id
 where co.platform='salla' and co.status='CONNECTED' and co.token_expires_at<now()+interval '2 days'
 order by co.token_expires_at limit 25;
$$;
revoke all on function public.salla_stores_due_refresh() from public,anon,authenticated;
grant execute on function public.salla_stores_due_refresh() to service_role;
