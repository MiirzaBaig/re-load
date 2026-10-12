-- Support access does not create merchant memberships or relax merchant RLS.
create table private.journey_activity (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id) on delete cascade,
 conversation_id uuid references public.whatsapp_conversations(id) on delete cascade,
 kind text not null, step text, created_at timestamptz not null default now()
);
create index journey_activity_store_time on private.journey_activity(store_id,created_at desc);
revoke all on private.journey_activity from public,anon,authenticated;

create function private.capture_journey_step() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' or new.step is distinct from old.step then
  insert into private.journey_activity(store_id,conversation_id,kind,step)
  select store_id,new.conversation_id,'step',new.step from public.whatsapp_conversations where id=new.conversation_id;
 end if;
 return new;
end $$;
create trigger capture_journey_step after insert or update of step on private.whatsapp_flow_state
 for each row execute function private.capture_journey_step();

-- Mask personal contacts and numeric verification codes in support transcripts.
create function private.support_text(value text) returns text language sql immutable set search_path='' as $$
 select left(regexp_replace(regexp_replace(coalesce(value,''),'[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}','[email hidden]','g'),'[+٠-٩۰-۹0-9][٠-٩۰-۹0-9 ()-]{4,}[٠-٩۰-۹0-9]','[number hidden]','g'),4096);
$$;
revoke all on function private.support_text(text) from public,anon,authenticated;

create function public.staff_support_workspace(p_store uuid,p_conversation uuid default null)
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
 'steps',coalesce((select jsonb_agg(x) from (select id,conversation_id,step,created_at from private.journey_activity where store_id=p_store and (p_conversation is null or conversation_id=p_conversation) order by created_at desc limit 150)x),'[]'),
 'audit',coalesce((select jsonb_agg(x) from (select id,event_type,entity_type,created_at from public.audit_events where store_id=p_store order by created_at desc limit 60)x),'[]'),
 'reviews',coalesce((select jsonb_agg(x) from (select id,conversation_id,status,created_at,reviewed_at from public.identity_reviews where store_id=p_store and (p_conversation is null or conversation_id=p_conversation) order by created_at desc limit 30)x),'[]'),
 'cases',coalesce((select jsonb_agg(x) from (select id,status,created_at from public.return_cases where store_id=p_store order by created_at desc limit 30)x),'[]'),
 'tickets',coalesce((select jsonb_agg(x) from (select id,conversation_id,kind,status,created_at from public.support_tickets where store_id=p_store and (p_conversation is null or conversation_id=p_conversation) order by created_at desc limit 30)x),'[]'),
 'issues',coalesce((select jsonb_agg(x) from (select id,provider,event_type,status,received_at from public.integration_events where store_id=p_store and status='FAILED' order by received_at desc limit 30)x),'[]')
 ) into result;
 return result;
end $$;
revoke all on function public.staff_support_workspace(uuid,uuid) from public,anon;
grant execute on function public.staff_support_workspace(uuid,uuid) to authenticated;

-- Owners may prepare NEW drafts. They cannot overwrite or publish merchant answers.
create function public.staff_prepare_knowledge(p_store uuid,p_title text,p_content text,p_category text,p_language text)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid;
begin
 if not private.platform_mfa_verified() or not exists(select 1 from public.platform_admins where user_id=auth.uid() and role='owner') then raise exception 'insufficient_permission' using errcode='42501'; end if;
 if length(trim(p_title)) not between 1 and 160 or length(trim(p_content)) not between 1 and 6000 or p_language not in ('ar','en') or p_category not in ('FAQ','DELIVERY','WARRANTY','SUPPORT','RETURNS','SIZING','CARE','PAYMENTS','LOCATIONS','CANCELLATION') then raise exception 'invalid_draft'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if (select count(*) from public.platform_admin_events where actor_user_id=auth.uid() and event_type='SUPPORT_DRAFT_PREPARED' and created_at>now()-interval '1 hour')>=30 then raise exception 'draft_limit'; end if;
 insert into public.store_knowledge(store_id,title,content,category,language,published,approved_by) values(p_store,trim(p_title),trim(p_content),p_category,p_language,false,null) returning id into saved;
 insert into public.platform_admin_events(actor_user_id,event_type,entity_type,entity_id) values(auth.uid(),'SUPPORT_DRAFT_PREPARED','store_knowledge',saved);
 insert into public.audit_events(store_id,actor_user_id,event_type,entity_type,entity_id) values(p_store,auth.uid(),'knowledge.staff.draft_prepared','store_knowledge',saved);
 return saved;
end $$;
revoke all on function public.staff_prepare_knowledge(uuid,text,text,text,text) from public,anon;
grant execute on function public.staff_prepare_knowledge(uuid,text,text,text,text) to authenticated;

-- Frontend reports use an allowlist, not raw URLs, error strings or payloads.
create function public.record_workspace_issue(p_store uuid,p_area text,p_kind text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_store_member(p_store) then raise exception 'insufficient_permission' using errcode='42501'; end if;
 if p_area not in ('workspace','knowledge','integrations','inbox','policies','cases') or p_kind not in ('screen_failed','load_failed','save_failed') then raise exception 'invalid_issue'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if (select count(*) from public.audit_events where actor_user_id=auth.uid() and event_type='workspace.issue' and created_at>now()-interval '1 hour')>=20 then return; end if;
 insert into public.audit_events(store_id,actor_user_id,event_type,entity_type,metadata) values(p_store,auth.uid(),'workspace.issue',p_area,jsonb_build_object('kind',p_kind));
end $$;
revoke all on function public.record_workspace_issue(uuid,text,text) from public,anon;
grant execute on function public.record_workspace_issue(uuid,text,text) to authenticated;

-- Keep step history bounded without deleting case/audit records.
select cron.schedule('reload-journey-cleanup','23 3 * * *','delete from private.journey_activity where created_at < now() - interval ''30 days''');
