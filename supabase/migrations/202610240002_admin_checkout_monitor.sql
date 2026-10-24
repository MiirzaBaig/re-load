-- Private, factual checkout history. No customer contacts, credentials or payment links.
create table private.zid_checkout_activity (
 id bigint generated always as identity primary key,
 session_hash text not null references private.zid_dev_checkouts(session_hash) on delete cascade,
 stage text not null check(stage in ('details_validated','creation_requested','order_saved','result_unconfirmed','attempt_failed','recheck','create_request','check_response','save_result','payment_checked')),
 outcome text not null check(outcome in ('done','waiting','unconfirmed','failed','pending','paid','unknown')),
 code text check(code in ('provider_unknown','permission_required','validation_failed','address_details_required','product_unavailable','selection_changed','review_expired','payment_unavailable','shipping_unavailable','session_expired','storage_unavailable','invalid_request','already_started','store_unavailable')),
 provider_status integer check(provider_status between 100 and 599),
 occurred_at timestamptz not null default now()
);
create index zid_checkout_activity_session_time on private.zid_checkout_activity(session_hash,occurred_at desc,id desc);
revoke all on private.zid_checkout_activity from public,anon,authenticated;

create function private.capture_zid_checkout_state() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' or new.state is distinct from old.state or (new.state='READY' and new.revision is distinct from old.revision) then
  insert into private.zid_checkout_activity(session_hash,stage,outcome)
  values(new.session_hash,
   case new.state when 'READY' then 'details_validated' when 'CREATING' then 'creation_requested' when 'CREATED' then 'order_saved' when 'UNKNOWN' then 'result_unconfirmed' else 'attempt_failed' end,
   case new.state when 'READY' then 'done' when 'CREATING' then 'waiting' when 'CREATED' then 'done' when 'UNKNOWN' then 'unconfirmed' else 'failed' end);
 end if;
 -- Opportunistic retention: triggered by later state changes, not a scheduled job.
 delete from private.zid_checkout_activity where occurred_at<now()-interval '30 days';
 return new;
end $$;
revoke all on function private.capture_zid_checkout_state() from public,anon,authenticated;
create trigger capture_zid_checkout_state after insert or update of state,revision on private.zid_dev_checkouts
 for each row execute function private.capture_zid_checkout_state();

create function public.record_zid_dev_checkout_observation(p_browser_hash text,p_stage text,p_outcome text,p_code text default null,p_provider_status integer default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare attempt text; current_state text;
begin
 if p_stage is null or p_outcome is null or p_stage not in ('recheck','create_request','check_response','save_result','payment_checked') then raise exception 'invalid_observation'; end if;
 if p_provider_status is not null and p_provider_status not between 100 and 599 then raise exception 'invalid_observation'; end if;
 select c.session_hash,c.state into attempt,current_state from private.zid_dev_checkouts c join private.zid_dev_oauth_attempts s on s.state_hash=c.session_hash
 where s.browser_hash=p_browser_hash and s.state='COMPLETE' and s.external_store_id='3258532';
 if attempt is null then return false; end if;
 if p_stage='payment_checked' then
  if current_state<>'CREATED' or p_outcome not in ('paid','pending','unknown') or p_code is not null or p_provider_status is not null then raise exception 'invalid_observation'; end if;
 else
  if current_state not in ('FAILED','UNKNOWN','CREATING') or p_outcome not in ('failed','unconfirmed') or p_code is null or p_code not in ('provider_unknown','permission_required','validation_failed','address_details_required','product_unavailable','selection_changed','review_expired','payment_unavailable','shipping_unavailable','session_expired','storage_unavailable','invalid_request','already_started','store_unavailable') then raise exception 'invalid_observation'; end if;
 end if;
 if exists(select 1 from private.zid_checkout_activity where session_hash=attempt and stage=p_stage and outcome=p_outcome and code is not distinct from p_code and provider_status is not distinct from p_provider_status and occurred_at>now()-interval '5 minutes') then return true; end if;
 insert into private.zid_checkout_activity(session_hash,stage,outcome,code,provider_status) values(attempt,p_stage,p_outcome,p_code,p_provider_status);
 return true;
end $$;
revoke all on function public.record_zid_dev_checkout_observation(text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.record_zid_dev_checkout_observation(text,text,text,text,integer) to service_role;

create function public.staff_checkout_monitor()
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if private.is_platform_owner() is not true or private.platform_mfa_verified() is not true then raise exception 'insufficient_permission' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text),20261024);
 if not exists(select 1 from public.platform_admin_events where actor_user_id=auth.uid() and event_type='CHECKOUT_MONITOR_VIEWED' and created_at>now()-interval '5 minutes') then
  insert into public.platform_admin_events(actor_user_id,event_type,entity_type) values(auth.uid(),'CHECKOUT_MONITOR_VIEWED','development_checkout');
 end if;
 select jsonb_build_object('environment','development','checked_at',now(),'limit',50,
 'blocked',exists(select 1 from private.zid_dev_checkouts where state in ('UNKNOWN','CREATING')),
 'records',coalesce(jsonb_agg(jsonb_build_object(
  'reference','CT-'||upper(substr(md5(c.session_hash),1,10)),
  'state',c.state,'updated_at',c.updated_at,'review_expires_at',c.expires_at,
  'has_order_reference',c.order_id is not null,
  'events',coalesce((select jsonb_agg(jsonb_build_object('stage',e.stage,'outcome',e.outcome,'code',e.code,'provider_status',e.provider_status,'occurred_at',e.occurred_at) order by e.occurred_at,e.id)
    from (select * from private.zid_checkout_activity where session_hash=c.session_hash order by occurred_at desc,id desc limit 30)e),'[]'::jsonb)
 ) order by c.updated_at desc),'[]'::jsonb)) into result
 from (select * from private.zid_dev_checkouts order by updated_at desc,session_hash limit 50)c;
 return result;
end $$;
revoke all on function public.staff_checkout_monitor() from public,anon;
grant execute on function public.staff_checkout_monitor() to authenticated;
