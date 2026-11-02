-- Sandbox collection confirmation, not a booking worker. Ciphertext only, 24-hour retention.
alter table private.whatsapp_flow_state drop constraint if exists whatsapp_flow_state_step_check;
alter table private.whatsapp_flow_state add constraint whatsapp_flow_state_step_check check(step in (
 'MENU','AWAITING_LANGUAGE','AWAITING_ORDER','AWAITING_EMAIL_OTP','AWAITING_ITEM','AWAITING_QUANTITY','AWAITING_REASON','AWAITING_CONDITION','AWAITING_PHOTO','AWAITING_CONFIRMATION','COMPLETE',
 'POLICY_READY','AWAITING_POLICY_METHOD','AWAITING_POLICY_URL','AWAITING_POLICY_TEXT','AWAITING_POLICY_WINDOW','REVIEWING_POLICY_RULE','AWAITING_RULE_EDIT','AWAITING_POLICY_PUBLISH','ONBOARDING_PAUSED','AWAITING_REPORT_MESSAGE','AWAITING_REPORT_CONFIRMATION','SHIPPING_COLLECTION'));
create table private.shipping_collection_confirmations(
 id uuid primary key,store_id uuid not null references public.stores(id),conversation_id uuid not null references public.whatsapp_conversations(id),
 case_id uuid not null unique references public.return_cases(id),settings_version integer not null,policy_version_id uuid not null references public.policy_versions(id),
 ciphertext text,state text not null default 'DETAILS_CONFIRMED' check(state in ('DETAILS_CONFIRMED','EXPIRED')),
 review_reason text not null default 'PARCEL_REVIEW_REQUIRED' check(review_reason='PARCEL_REVIEW_REQUIRED'),
 confirmed_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '24 hours'
);
alter table private.shipping_collection_confirmations enable row level security;
revoke all on private.shipping_collection_confirmations from public,anon,authenticated,service_role;

create function private.shipping_collection_binding(p_store uuid,p_conversation uuid,p_case uuid) returns boolean
language sql security definer set search_path='' as $$
 select exists(select 1 from public.whatsapp_conversations v join public.return_cases c on c.store_id=v.store_id
 where v.id=p_conversation and v.store_id=p_store and c.id=p_case and
 (v.return_case_id=c.id or exists(select 1 from private.whatsapp_case_links l where l.conversation_id=v.id and l.case_id=c.id)));
$$;
revoke all on function private.shipping_collection_binding(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function public.shipping_collection_purge() returns void language plpgsql security definer set search_path='' as $$
begin
 update private.shipping_collection_confirmations set ciphertext=null,state='EXPIRED' where expires_at<=now() and ciphertext is not null;
 -- Remove only this feature's encrypted drafts, including drafts paused under menu/help.
 update private.whatsapp_flow_state set context=context-'collection' where (context->'collection'->>'expiresAt')::numeric<extract(epoch from now())*1000;
 update private.whatsapp_flow_state set context=jsonb_set(context,'{returnResume,context}',(context#>'{returnResume,context}')-'collection') where (context#>>'{returnResume,context,collection,expiresAt}')::numeric<extract(epoch from now())*1000;
end $$;
revoke all on function public.shipping_collection_purge() from public,anon,authenticated;
grant execute on function public.shipping_collection_purge() to service_role;

create function public.shipping_collection_gate(p_store uuid,p_conversation uuid,p_case uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private.shipping_settings;c public.return_cases;d public.eligibility_decisions;policy_id uuid;
begin
 perform public.shipping_collection_purge();
 if not private.shipping_collection_binding(p_store,p_conversation,p_case) then raise exception 'access_denied';end if;
 if exists(select 1 from private.shipping_collection_confirmations where case_id=p_case) then return jsonb_build_object('confirmed',true);end if;
 select * into c from public.return_cases where id=p_case and store_id=p_store;
 select * into d from public.eligibility_decisions where id=c.decision_id and store_id=p_store;
 select * into s from private.shipping_settings where store_id=p_store;
 select id into policy_id from public.policy_versions where store_id=p_store order by published_at desc,id desc limit 1;
 if c.status<>'OPEN' or d.outcome<>'ELIGIBLE' or d.policy_version_id is distinct from policy_id or s.state is distinct from 'APPROVED' or not s.automatic_requested or s.policy_version_id is distinct from policy_id or not exists(select 1 from private.shipping_warehouses where id=s.warehouse_id and store_id=p_store and environment='sandbox' and state='ACTIVE') or not exists(select 1 from public.store_billing where store_id=p_store and environment='sandbox' and plan='premium' and status='ACTIVE' and period_start<=now() and period_end>now()) then return jsonb_build_object('allowed',false);end if;
 return jsonb_build_object('allowed',true,'version',s.version,'method',s.collection_method);
end $$;
create function public.shipping_collection_confirm(p_store uuid,p_conversation uuid,p_case uuid,p_id uuid,p_version integer,p_ciphertext text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare gate jsonb;existing private.shipping_collection_confirmations;policy_id uuid;
begin
 if not private.shipping_collection_binding(p_store,p_conversation,p_case) then raise exception 'access_denied';end if;
 perform pg_advisory_xact_lock(hashtext('shipping_settings'),hashtext(p_store::text));
 perform pg_advisory_xact_lock(hashtext('shipping_collection'),hashtext(p_case::text));
 select * into existing from private.shipping_collection_confirmations where case_id=p_case;
 if existing.id is not null then return jsonb_build_object('confirmed',true);end if;
 if p_id is null or p_version is null or p_ciphertext is null or length(p_ciphertext)>8192 or p_ciphertext !~ '^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$' then raise exception 'invalid_input';end if;
 gate:=public.shipping_collection_gate(p_store,p_conversation,p_case);
 if coalesce((gate->>'allowed')::boolean,false)=false or (gate->>'version')::integer<>p_version then return jsonb_build_object('confirmed',false);end if;
 select policy_version_id into policy_id from private.shipping_settings where store_id=p_store;
 insert into private.shipping_collection_confirmations(id,store_id,conversation_id,case_id,settings_version,policy_version_id,ciphertext)
 values(p_id,p_store,p_conversation,p_case,p_version,policy_id,p_ciphertext);
 insert into private.journey_activity(store_id,conversation_id,kind,step) values(p_store,p_conversation,'step','COLLECTION_DETAILS_CONFIRMED');
 return jsonb_build_object('confirmed',true);
end $$;
revoke all on function public.shipping_collection_gate(uuid,uuid,uuid),public.shipping_collection_confirm(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.shipping_collection_gate(uuid,uuid,uuid),public.shipping_collection_confirm(uuid,uuid,uuid,uuid,integer,text) to service_role;
-- Bound cleanup independently of traffic, when the hosted project's scheduler is available.
do $$ begin
 if to_regclass('cron.job') is not null then
  perform cron.schedule('shipping-collection-retention','*/15 * * * *','select public.shipping_collection_purge()');
 end if;
end $$;

-- Redact raw collection input only in the same transaction that saves its recoverable reply.
-- Before that commit the ordered inbox retains the original input for safe retry.
create or replace function public.commit_whatsapp_transition(p_message text,p_conversation uuid,p_step text,p_context jsonb,p_reply jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare sensitive boolean;
begin
 perform 1 from private.whatsapp_inbox where id=p_message and status='PROCESSING' for update;
 if not found then raise exception 'inbox_lease_missing';end if;
 sensitive:=p_step='SHIPPING_COLLECTION' or exists(select 1 from private.whatsapp_flow_state where conversation_id=p_conversation and step='SHIPPING_COLLECTION');
 if p_step is not null then perform public.set_whatsapp_flow_state(p_conversation,p_step,p_context);end if;
 if p_context->>'caseId' is not null then
  insert into private.whatsapp_case_links(conversation_id,case_id)
  select v.id,c.id from public.whatsapp_conversations v join public.return_cases c on c.store_id=v.store_id
  where v.id=p_conversation and c.id=(p_context->>'caseId')::uuid on conflict do nothing;
 end if;
 update private.whatsapp_inbox set reply=p_reply,message=case when sensitive then
  jsonb_build_object('id',message->'id','from',message->'from','type','text','timestamp',message->'timestamp','text',jsonb_build_object('body','[Return collection details hidden]')) else message end where id=p_message;
end $$;

create or replace function public.record_journey_issue(p_conversation uuid,p_kind text,p_message text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_kind not in ('order_lookup_unavailable','photo_read_unavailable','billing_waiting','shipping_details_unavailable') then raise exception 'invalid_issue';end if;
 insert into private.journey_activity(store_id,conversation_id,kind,step,source_message_id)
 select store_id,id,'issue',p_kind,left(p_message,200) from public.whatsapp_conversations where id=p_conversation on conflict do nothing;
end $$;
revoke all on function public.record_journey_issue(uuid,text,text) from public,anon,authenticated;
grant execute on function public.record_journey_issue(uuid,text,text) to service_role;

create function public.shipping_collection_status(p_store uuid,p_conversation uuid,p_case uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not private.shipping_collection_binding(p_store,p_conversation,p_case) then raise exception 'access_denied';end if;
 perform public.shipping_collection_purge();
 return (select jsonb_build_object('state',state,'reviewReason',review_reason) from private.shipping_collection_confirmations where store_id=p_store and conversation_id=p_conversation and case_id=p_case);
end $$;
revoke all on function public.shipping_collection_status(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.shipping_collection_status(uuid,uuid,uuid) to service_role;

-- Stage names only: support staff never receive customer address fields or ciphertext.
create or replace function private.capture_journey_step() returns trigger language plpgsql security definer set search_path='' as $$
declare stage text;
begin
 if TG_OP='INSERT' or new.step is distinct from old.step or
  (new.step='SHIPPING_COLLECTION' and new.context#>>'{collection,stage}' is distinct from old.context#>>'{collection,stage}') then
  stage:=case when new.step='SHIPPING_COLLECTION' and new.context#>>'{collection,stage}' in ('CITY','ADDRESS','BUILDING','POSTCODE','REVIEW','EDIT') then 'COLLECTION_'||(new.context#>>'{collection,stage}') else new.step end;
  insert into private.journey_activity(store_id,conversation_id,kind,step)
  select store_id,new.conversation_id,'step',stage from public.whatsapp_conversations where id=new.conversation_id;
 end if;return new;
end $$;
