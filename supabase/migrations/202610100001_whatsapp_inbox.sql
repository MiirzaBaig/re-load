-- Durable, ordered inbox. Raw messages and prepared replies are service-only.
create table private.whatsapp_inbox (
 id text primary key, sequence bigint generated always as identity,
 phone_id text not null, sender text not null, message jsonb not null, profile_name text,
 status text not null default 'QUEUED' check(status in ('QUEUED','PROCESSING','DONE','FAILED','UNCERTAIN')),
 attempts integer not null default 0, available_at timestamptz not null default now(),
 lease_until timestamptz, send_started_at timestamptz, reply jsonb, accepted_result jsonb, last_error text,
 created_at timestamptz not null default now(), finished_at timestamptz
);
create index whatsapp_inbox_work_idx on private.whatsapp_inbox(status,available_at,sequence);
revoke all on private.whatsapp_inbox from public,anon,authenticated;
create table private.whatsapp_worker_tickets(id uuid primary key, expires_at timestamptz not null);
revoke all on private.whatsapp_worker_tickets from public,anon,authenticated;

create function private.dispatch_whatsapp_inbox() returns void
language plpgsql security definer set search_path='' as $$
declare ticket uuid := gen_random_uuid();
begin
 delete from private.whatsapp_worker_tickets where expires_at<now();
 if not exists(select 1 from private.whatsapp_inbox where status='QUEUED' and available_at<=now() or status='PROCESSING' and lease_until<now()) then return; end if;
 insert into private.whatsapp_worker_tickets values(ticket,now()+interval '5 minutes');
 perform net.http_post(
  url:='https://clwczcvxosudfevjznmk.supabase.co/functions/v1/whatsapp-inbox',
  headers:='{"Content-Type":"application/json"}'::jsonb,
  body:=jsonb_build_object('ticket',ticket),timeout_milliseconds:=60000);
exception when others then raise warning 'whatsapp inbox dispatch failed';
end $$;
revoke all on function private.dispatch_whatsapp_inbox() from public,anon,authenticated;

create function public.enqueue_whatsapp_message(p_phone text,p_sender text,p_message jsonb,p_name text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if nullif(p_message->>'id','') is null or nullif(p_sender,'') is null then raise exception 'invalid_message'; end if;
 insert into private.whatsapp_inbox(id,phone_id,sender,message,profile_name)
 values(p_message->>'id',p_phone,p_sender,p_message,left(p_name,120)) on conflict(id) do nothing;
 insert into public.integration_events(provider,external_event_id,event_type,payload_digest,status)
 values('whatsapp',p_message->>'id','WHATSAPP_INBOX','stored_privately','RECEIVED') on conflict(provider,external_event_id) do nothing;
 perform private.dispatch_whatsapp_inbox();
end $$;

create function public.consume_whatsapp_worker_ticket(p_ticket uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 delete from private.whatsapp_worker_tickets where id=p_ticket and expires_at>now();
 return found;
end $$;

create function public.claim_whatsapp_inbox()
returns setof private.whatsapp_inbox language plpgsql security definer set search_path='' as $$
declare job private.whatsapp_inbox;
begin
 -- A worker that died during an unacknowledged send may have delivered it.
 -- Preserve the uncertainty instead of blindly sending it a second time.
 update private.whatsapp_inbox set status='UNCERTAIN',last_error='send_receipt_unknown'
 where status='PROCESSING' and lease_until<now() and send_started_at is not null and accepted_result is null;
 update public.integration_events e set status='FAILED',last_error='send_receipt_unknown' where e.provider='whatsapp'
 and exists(select 1 from private.whatsapp_inbox i where i.id=e.external_event_id and i.status='UNCERTAIN');
 select * into job from private.whatsapp_inbox i
 where (i.status='QUEUED' and i.available_at<=now() or i.status='PROCESSING' and i.lease_until<now())
 and not exists(select 1 from private.whatsapp_inbox earlier where earlier.phone_id=i.phone_id and earlier.sender=i.sender
 and earlier.sequence<i.sequence and earlier.status in ('QUEUED','PROCESSING'))
 order by i.sequence for update skip locked limit 1;
 if job.id is null then return; end if;
 update private.whatsapp_inbox set status='PROCESSING',attempts=attempts+1,lease_until=now()+interval '2 minutes' where id=job.id;
 update public.integration_events set status='FAILED' where provider='whatsapp' and external_event_id=job.id and status='PROCESSING';
 return query select * from private.whatsapp_inbox where id=job.id;
end $$;

create function public.save_whatsapp_reply(p_id text,p_reply jsonb,p_accepted jsonb default null)
returns void language sql security definer set search_path='' as $$
 update private.whatsapp_inbox set reply=p_reply,accepted_result=coalesce(p_accepted,accepted_result) where id=p_id and status='PROCESSING';
$$;
create function public.mark_whatsapp_send_started(p_id text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update private.whatsapp_inbox set send_started_at=now() where id=p_id and status='PROCESSING' and reply is not null and accepted_result is null;
 return found;
end $$;
create function public.retry_uncertain_whatsapp_message(p_id text,p_confirmed_not_delivered boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_confirmed_not_delivered is distinct from true then raise exception 'check_delivery_first'; end if;
 update private.whatsapp_inbox set status='QUEUED',send_started_at=null,available_at=now(),last_error=null where id=p_id and status='UNCERTAIN';
 if not found then return false; end if;
 update public.integration_events set status='FAILED',last_error='operator_confirmed_not_delivered' where provider='whatsapp' and external_event_id=p_id;
 perform private.dispatch_whatsapp_inbox();
 return true;
end $$;
revoke all on function public.mark_whatsapp_send_started(text),public.retry_uncertain_whatsapp_message(text,boolean) from public,anon,authenticated;
grant execute on function public.mark_whatsapp_send_started(text),public.retry_uncertain_whatsapp_message(text,boolean) to service_role;

create function public.finish_whatsapp_inbox(p_id text,p_error text default null,p_uncertain boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 update private.whatsapp_inbox set
 status=case when p_error is null then 'DONE' when p_uncertain then 'UNCERTAIN' when attempts>=5 then 'FAILED' else 'QUEUED' end,
 last_error=left(p_error,180),available_at=now()+make_interval(secs=>least(300,attempts*30)),
 lease_until=null,finished_at=case when p_error is null then now() else null end
 where id=p_id;
 -- Keep only a short recovery window for private raw messages/order context.
 delete from private.whatsapp_inbox where status='DONE' and finished_at<now()-interval '7 days';
 delete from private.identity_review_facts where expires_at<now();
end $$;

revoke all on function public.enqueue_whatsapp_message(text,text,jsonb,text), public.consume_whatsapp_worker_ticket(uuid),
 public.claim_whatsapp_inbox(),public.save_whatsapp_reply(text,jsonb,jsonb),public.finish_whatsapp_inbox(text,text,boolean) from public,anon,authenticated;
grant execute on function public.enqueue_whatsapp_message(text,text,jsonb,text),public.consume_whatsapp_worker_ticket(uuid),
 public.claim_whatsapp_inbox(),public.save_whatsapp_reply(text,jsonb,jsonb),public.finish_whatsapp_inbox(text,text,boolean) to service_role;

create extension if not exists pg_cron;
select cron.schedule('reload-whatsapp-inbox','* * * * *','select private.dispatch_whatsapp_inbox()');

create table private.whatsapp_case_links (
 conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
 case_id uuid not null references public.return_cases(id) on delete cascade,
 primary key(conversation_id,case_id)
);
revoke all on private.whatsapp_case_links from public,anon,authenticated;
create function public.get_whatsapp_cases(p_conversation uuid)
returns table(id uuid,order_id text,status text) language sql security definer set search_path='' as $$
 select c.id,c.order_id,c.status from public.return_cases c
 join private.whatsapp_case_links l on l.case_id=c.id
 join public.whatsapp_conversations v on v.id=l.conversation_id and v.store_id=c.store_id
 where v.id=p_conversation order by c.created_at desc limit 10;
$$;
revoke all on function public.get_whatsapp_cases(uuid) from public,anon,authenticated;
grant execute on function public.get_whatsapp_cases(uuid) to service_role;

-- Persist a state transition together with the reply that explains it.
alter table private.whatsapp_inbox add column effects jsonb not null default '{}'::jsonb;
create function public.commit_whatsapp_transition(p_message text,p_conversation uuid,p_step text,p_context jsonb,p_reply jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from private.whatsapp_inbox where id=p_message and status='PROCESSING' for update;
 if not found then raise exception 'inbox_lease_missing'; end if;
 if p_step is not null then perform public.set_whatsapp_flow_state(p_conversation,p_step,p_context); end if;
 if p_context->>'caseId' is not null then
  insert into private.whatsapp_case_links(conversation_id,case_id)
  select v.id,c.id from public.whatsapp_conversations v join public.return_cases c on c.store_id=v.store_id
  where v.id=p_conversation and c.id=(p_context->>'caseId')::uuid on conflict do nothing;
 end if;
 update private.whatsapp_inbox set reply=p_reply where id=p_message;
end $$;

create function public.record_whatsapp_decision(p_message text,p_parameters jsonb,p_decision jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare job private.whatsapp_inbox; saved uuid; result jsonb;
begin
 select * into job from private.whatsapp_inbox where id=p_message and status='PROCESSING' for update;
 if job.id is null then raise exception 'inbox_lease_missing'; end if;
 if job.effects ? 'decision' then return job.effects->'decision'; end if;
 select decision_id into saved from public.record_return_decision(
 (p_parameters->>'p_store_id')::uuid,(p_parameters->>'p_policy_version_id')::uuid,p_parameters->>'p_order_id',
 p_parameters->>'p_outcome',array(select jsonb_array_elements_text(p_parameters->'p_reason_codes')),
 p_parameters->'p_order_facts',p_parameters->'p_policy_snapshot',p_parameters->'p_customer_snapshot',p_parameters->'p_item_snapshot',false);
 result:=jsonb_build_object('decision',p_decision,'decisionId',saved);
 update private.whatsapp_inbox set effects=jsonb_set(effects,'{decision}',result) where id=p_message;
 return result;
end $$;

create function public.record_whatsapp_report(p_message text,p_report jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare job private.whatsapp_inbox; saved uuid;
begin
 select * into job from private.whatsapp_inbox where id=p_message and status='PROCESSING' for update;
 if job.id is null then raise exception 'inbox_lease_missing'; end if;
 if job.effects ? 'report' then return (job.effects->>'report')::uuid; end if;
 insert into public.product_reports(store_id,conversation_id,report_type,message,source_channel,context)
 values((p_report->>'store_id')::uuid,(p_report->>'conversation_id')::uuid,p_report->>'report_type',p_report->>'message','WHATSAPP',p_report->'context') returning id into saved;
 update private.whatsapp_inbox set effects=jsonb_set(effects,'{report}',to_jsonb(saved)) where id=p_message;
 return saved;
end $$;
revoke all on function public.commit_whatsapp_transition(text,uuid,text,jsonb,jsonb),public.record_whatsapp_decision(text,jsonb,jsonb),public.record_whatsapp_report(text,jsonb) from public,anon,authenticated;
grant execute on function public.commit_whatsapp_transition(text,uuid,text,jsonb,jsonb),public.record_whatsapp_decision(text,jsonb,jsonb),public.record_whatsapp_report(text,jsonb) to service_role;

create function public.get_whatsapp_case_conversation(p_case uuid)
returns uuid language sql security definer set search_path='' as $$
 select v.id from private.whatsapp_case_links l join public.whatsapp_conversations v on v.id=l.conversation_id
 join public.return_cases c on c.id=l.case_id and c.store_id=v.store_id
 where l.case_id=p_case order by v.last_message_at desc limit 1;
$$;
revoke all on function public.get_whatsapp_case_conversation(uuid) from public,anon,authenticated;
grant execute on function public.get_whatsapp_case_conversation(uuid) to service_role;
