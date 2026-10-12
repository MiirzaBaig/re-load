-- Track technical lookup failures separately from expected identity checks.
alter table private.journey_activity add column source_message_id text;
create unique index journey_issue_source on private.journey_activity(conversation_id,source_message_id,step) where source_message_id is not null and kind='issue';
create function public.record_journey_issue(p_conversation uuid,p_kind text,p_message text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_kind not in ('order_lookup_unavailable','photo_read_unavailable') then raise exception 'invalid_issue'; end if;
 insert into private.journey_activity(store_id,conversation_id,kind,step,source_message_id)
 select store_id,id,'issue',p_kind,left(p_message,200) from public.whatsapp_conversations where id=p_conversation
 on conflict do nothing;
end $$;
revoke all on function public.record_journey_issue(uuid,text,text) from public,anon,authenticated;
grant execute on function public.record_journey_issue(uuid,text,text) to service_role;

create or replace function public.staff_support_workspace(p_store uuid,p_conversation uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_platform_admin() or not private.platform_mfa_verified() then raise exception 'insufficient_permission' using errcode='42501'; end if;
 if not exists(select 1 from public.stores where id=p_store) then raise exception 'store_not_found'; end if;
 if p_conversation is not null and not exists(select 1 from public.whatsapp_conversations where id=p_conversation and store_id=p_store) then raise exception 'conversation_mismatch'; end if;
 -- Every access is audited; repeated polling is grouped within five minutes.
 if not exists(select 1 from public.platform_admin_events where actor_user_id=auth.uid() and entity_id=p_store and event_type='SUPPORT_WORKSPACE_VIEWED' and created_at>now()-interval '5 minutes') then
  insert into public.platform_admin_events(actor_user_id,event_type,entity_type,entity_id) values(auth.uid(),'SUPPORT_WORKSPACE_VIEWED','store',p_store);
 end if;
 select jsonb_build_object(
 'store',(select jsonb_build_object('id',s.id,'name',s.name,'created_at',s.created_at) from public.stores s where id=p_store),
 'connections',coalesce((select jsonb_agg(jsonb_build_object('platform',platform,'name',external_store_name,'status',status,'connected_at',connected_at)) from public.commerce_connections where store_id=p_store),'[]'),
 'whatsapp',(select jsonb_build_object('status',status,'connected_at',connected_at,'last_webhook_at',last_webhook_at) from public.whatsapp_connections where store_id=p_store),
 'policies',coalesce((select jsonb_agg(x) from (select version_label,published_at,jsonb_array_length(rules_snapshot) rule_count from public.policy_versions where store_id=p_store order by published_at desc limit 10)x),'[]'),
 'knowledge',coalesce((select jsonb_agg(x) from (select id,title,content,category,language,published,updated_at from public.store_knowledge where store_id=p_store order by updated_at desc limit 100)x),'[]'),
 'conversations',coalesce((select jsonb_agg(x) from (select c.id,c.language,c.created_at,c.last_message_at,coalesce(f.step,'MENU') step,
 (select count(*) from public.whatsapp_messages m where m.conversation_id=c.id) message_count
 from public.whatsapp_conversations c left join private.whatsapp_flow_state f on f.conversation_id=c.id where c.store_id=p_store order by c.last_message_at desc nulls last limit 30)x),'[]'),
 'messages',coalesce((select jsonb_agg(x) from (select m.id,m.conversation_id,m.direction,m.message_type,m.status,m.occurred_at,private.support_text(m.body) body,
 exists(select 1 from private.whatsapp_inbox i where i.id=m.external_message_id and i.status in ('FAILED','UNCERTAIN')) processing_failed
 from public.whatsapp_messages m where m.store_id=p_store and (p_conversation is null or m.conversation_id=p_conversation) order by m.occurred_at desc limit 150)x),'[]'),
 'steps',coalesce((select jsonb_agg(x) from (select id,conversation_id,kind,step,created_at from private.journey_activity where store_id=p_store and (p_conversation is null or conversation_id=p_conversation) order by created_at desc limit 150)x),'[]'),
 'audit',coalesce((select jsonb_agg(x) from (select id,event_type,entity_type,created_at from public.audit_events where store_id=p_store order by created_at desc limit 60)x),'[]'),
 'reviews',coalesce((select jsonb_agg(x) from (select id,conversation_id,status,created_at,reviewed_at from public.identity_reviews where store_id=p_store and (p_conversation is null or conversation_id=p_conversation) order by created_at desc limit 30)x),'[]'),
 'cases',coalesce((select jsonb_agg(x) from (select r.id,r.status,r.created_at,r.updated_at,coalesce((select jsonb_agg(l.conversation_id) from private.whatsapp_case_links l where l.case_id=r.id),'[]') conversation_ids from public.return_cases r where r.store_id=p_store order by r.created_at desc limit 30)x),'[]'),
 'tickets',coalesce((select jsonb_agg(x) from (select id,conversation_id,kind,status,created_at,updated_at from public.support_tickets where store_id=p_store and (p_conversation is null or conversation_id=p_conversation) order by created_at desc limit 30)x),'[]'),
 'issues',coalesce((select jsonb_agg(x) from (select id,provider,event_type,status,received_at,case when last_error='send_receipt_unknown' then 'delivery_uncertain' when last_error ilike '%token%' then 'authorization' when last_error ilike '%timeout%' then 'timeout' else 'processing' end reason from public.integration_events where store_id=p_store and status='FAILED' order by received_at desc limit 30)x),'[]')
 ) into result;
 return result;
end $$;
revoke all on function public.staff_support_workspace(uuid,uuid) from public,anon;
grant execute on function public.staff_support_workspace(uuid,uuid) to authenticated;

