-- Annual payment periods and monthly usage periods are deliberately separate.
alter table public.store_billing add column billing_interval text not null default 'monthly' check(billing_interval in ('monthly','annual')),
 add column pending_interval text check(pending_interval in ('monthly','annual')), add column override_period_start timestamptz;
update public.store_billing set override_period_start=period_start where included_override is not null;
alter table public.billing_checkouts add column billing_interval text not null default 'monthly' check(billing_interval in ('monthly','annual')), add column upgrade_allowance_start timestamptz;
alter table public.billing_payments add column billing_interval text not null default 'monthly' check(billing_interval in ('monthly','annual'));
alter table public.billing_catalog add column billing_interval text not null default 'monthly' check(billing_interval in ('monthly','annual'));
alter table public.billing_catalog drop constraint billing_catalog_pkey;
alter table public.billing_catalog add primary key(environment,plan,billing_interval);

-- UTC anniversaries clamp month ends from the original anchor, never from a previously clamped date.
create function public.billing_month_start(p_anchor timestamptz,p_at timestamptz) returns timestamptz
language plpgsql immutable set search_path='' as $$
declare a timestamp:=p_anchor at time zone 'UTC'; t timestamp:=p_at at time zone 'UTC'; n integer; candidate timestamp; begin
 if a is null or t is null then return null; end if;
 n:=greatest(0,(extract(year from t)::integer-extract(year from a)::integer)*12+extract(month from t)::integer-extract(month from a)::integer);
 candidate:=a+make_interval(months=>n);
 if candidate>t and n>0 then candidate:=a+make_interval(months=>n-1); end if;
 return candidate at time zone 'UTC';
end $$;
create function public.billing_month_end(p_anchor timestamptz,p_at timestamptz) returns timestamptz
language plpgsql immutable set search_path='' as $$
declare s timestamp:=public.billing_month_start(p_anchor,p_at) at time zone 'UTC'; a timestamp:=p_anchor at time zone 'UTC'; n integer; begin
 if s is null then return null; end if;
 n:=(extract(year from s)::integer-extract(year from a)::integer)*12+extract(month from s)::integer-extract(month from a)::integer;
 return (a+make_interval(months=>n+1)) at time zone 'UTC';
end $$;
revoke all on function public.billing_month_start(timestamptz,timestamptz),public.billing_month_end(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.billing_month_start(timestamptz,timestamptz),public.billing_month_end(timestamptz,timestamptz) to service_role;

drop function public.billing_start_checkout(uuid,text,uuid,text,text);
drop function public.billing_apply_invoice(uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,text);
create or replace function public.billing_start_checkout(p_store uuid,p_environment text,p_user uuid,p_plan text,p_kind text default 'SUBSCRIPTION',p_interval text default 'monthly') returns public.billing_checkouts
language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.store_billing; c public.billing_checkouts; amount integer; offer boolean; fraction numeric; usage_fraction numeric; effective_interval text; begin
 if p_environment not in ('sandbox','live') or p_interval not in ('monthly','annual') or p_kind not in ('SUBSCRIPTION','UPGRADE','BUNDLE') or p_plan not in ('standard','premium') then raise exception 'invalid_checkout'; end if;
 perform pg_advisory_xact_lock(hashtext(p_store::text||p_environment));
 if not exists(select 1 from public.memberships where store_id=p_store and user_id=p_user and role in ('owner','admin')) then raise exception 'insufficient_permission'; end if;
 update public.billing_checkouts set status='REVIEW' where store_id=p_store and environment=p_environment and status in ('CREATING','READY') and expires_at<now();
 select * into c from public.billing_checkouts where store_id=p_store and environment=p_environment and status in ('CREATING','READY','REVIEW');
 if found then
  if c.plan<>p_plan or c.kind<>p_kind or (p_kind='SUBSCRIPTION' and c.billing_interval<>p_interval) then raise exception 'checkout_in_progress'; end if;
  return c;
 end if;
 select * into b from public.store_billing where store_id=p_store and environment=p_environment;
 if p_kind='SUBSCRIPTION' and b.subscription_id is not null and (b.status<>'CANCELED' or b.period_end>now()) then raise exception 'subscription_exists'; end if;
 effective_interval:=case when p_kind='SUBSCRIPTION' then p_interval else coalesce(b.billing_interval,'monthly') end;
 if p_kind='UPGRADE' then
  if b.plan is distinct from 'standard' or b.status<>'ACTIVE' or b.period_end<=now() or b.period_start>now() then raise exception 'upgrade_not_available'; end if;
  if b.pending_interval is not null then raise exception 'scheduled_change_exists'; end if;
  if p_plan<>'premium' then raise exception 'invalid_plan'; end if;
  fraction:=extract(epoch from (b.period_end-now()))/extract(epoch from (b.period_end-b.period_start));
  amount:=ceil((case b.billing_interval when 'annual' then 144000 else 15000 end)*fraction);
  usage_fraction:=extract(epoch from (least(public.billing_month_end(b.period_start,now()),b.period_end)-now()))/extract(epoch from (least(public.billing_month_end(b.period_start,now()),b.period_end)-public.billing_month_start(b.period_start,now()))); offer:=false;
  if amount<100 then raise exception 'upgrade_too_close_to_renewal'; end if;
 elsif p_kind='BUNDLE' then
  if b.plan is null or b.plan<>'premium' or b.status<>'ACTIVE' or b.period_end<=now() then raise exception 'premium_required'; end if;
  select bundle_price_halalas into amount from public.billing_settings where id;
  if amount is null then raise exception 'bundles_not_available'; end if;
  offer:=false;
 else
  if p_plan not in ('standard','premium') then raise exception 'invalid_plan'; end if;
  perform pg_advisory_xact_lock(hashtext('reload_founding_offer'));
  offer:=p_interval='monthly' and exists(select 1 from public.billing_offers where store_id=p_store and environment=p_environment and redeemed_at is null)
   and not exists(select 1 from public.billing_payments where store_id=p_store and environment=p_environment)
   and not exists(select 1 from public.billing_offers where environment=p_environment and paying_user_id=p_user and store_id<>p_store and redeemed_at is not null)
   and not exists(select 1 from public.billing_checkouts where environment=p_environment and user_id=p_user and store_id<>p_store and launch_offer and status in ('CREATING','READY','REVIEW'));
  amount:=case when p_interval='annual' then case p_plan when 'standard' then 143040 else 287040 end else case p_plan when 'standard' then case when offer then 9900 else 14900 end else case when offer then 19900 else 29900 end end end;
 end if;
 insert into public.billing_checkouts(store_id,environment,user_id,plan,kind,amount_halalas,launch_offer,upgrade_subscription_id,upgrade_period_start,upgrade_period_end,upgrade_messages,billing_interval,upgrade_allowance_start)
 values(p_store,p_environment,p_user,p_plan,p_kind,amount,offer,case when p_kind='UPGRADE' then b.subscription_id end,case when p_kind='UPGRADE' then b.period_start end,case when p_kind='UPGRADE' then b.period_end end,case when p_kind='UPGRADE' then floor(1500*usage_fraction)::integer end,effective_interval,case when p_kind='UPGRADE' then public.billing_month_start(b.period_start,now()) end) returning * into c;
 return c;
end $$;


create or replace function public.billing_apply_invoice(p_checkout uuid,p_invoice uuid,p_subscription uuid,p_start timestamptz,p_end timestamptz,p_refunded integer default 0,p_amount integer default null,p_plan text default null,p_interval text default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.billing_checkouts; existing public.store_billing; payment public.billing_payments; cycle text; begin
 select * into c from public.billing_checkouts where id=p_checkout for update;
 if not found or c.status not in ('READY','PAID') then raise exception 'checkout_not_ready'; end if;
 if p_plan is not null then
  if p_plan not in ('standard','premium') then raise exception 'invalid_plan'; end if;
  c.plan:=p_plan;
 end if;
 perform pg_advisory_xact_lock(hashtext(c.store_id::text||c.environment));
 select * into payment from public.billing_payments where environment=c.environment and invoice_id=p_invoice for update;
 if found then
  if payment.store_id<>c.store_id then raise exception 'invoice_store_mismatch'; end if;
  if c.kind in ('UPGRADE','BUNDLE') and p_refunded>0 then raise exception 'refund_requires_review'; end if;
  update public.billing_payments set refunded_halalas=greatest(refunded_halalas,p_refunded) where environment=c.environment and invoice_id=p_invoice;
  if p_refunded>=payment.amount_halalas then update public.store_billing set status='FROZEN',updated_at=now() where store_id=c.store_id and environment=c.environment and last_invoice_id=p_invoice; end if;
  return;
 end if;
 cycle:=coalesce(p_interval,c.billing_interval);
 if cycle not in ('monthly','annual') then raise exception 'invalid_interval'; end if;
 if c.launch_offer then
  perform pg_advisory_xact_lock(hashtext('reload_founding_offer'));
  if not exists(select 1 from public.billing_offers where store_id=c.store_id and environment=c.environment) then raise exception 'offer_missing'; end if;
 end if;
 insert into public.billing_payments(environment,invoice_id,store_id,subscription_id,plan,amount_halalas,kind,refunded_halalas,period_start,period_end,billing_interval)
 values(c.environment,p_invoice,c.store_id,p_subscription,c.plan,coalesce(p_amount,c.amount_halalas),c.kind,p_refunded,p_start,p_end,cycle);
 if c.kind='UPGRADE' then
  select * into existing from public.store_billing where store_id=c.store_id and environment=c.environment for update;
  if existing.subscription_id is distinct from c.upgrade_subscription_id or existing.period_start is distinct from c.upgrade_period_start or public.billing_month_start(existing.period_start,now()) is distinct from c.upgrade_allowance_start then raise exception 'upgrade_period_changed'; end if;
  if p_refunded>0 then raise exception 'upgrade_refund_requires_review'; end if;
  update public.store_billing set plan='premium',included_override=500+c.upgrade_messages,override_period_start=c.upgrade_allowance_start,updated_at=now() where store_id=c.store_id and environment=c.environment;
 elsif c.kind='BUNDLE' then
  if p_refunded>0 then raise exception 'bundle_refund_requires_review'; end if;
  insert into public.billing_bundle_credits(store_id,environment,invoice_id,purchased) values(c.store_id,c.environment,p_invoice,2000) on conflict do nothing;
 else
  if p_subscription is null or p_start is null or p_end is null or p_end<=p_start or (cycle='monthly' and (p_end>p_start+interval '40 days' or p_end<p_start+interval '20 days')) or (cycle='annual' and (p_end>p_start+interval '370 days' or p_end<p_start+interval '330 days')) then raise exception 'invalid_period'; end if;
  select * into existing from public.store_billing where store_id=c.store_id and environment=c.environment for update;
  if existing.subscription_id is not null and existing.subscription_id<>p_subscription and not (existing.status='CANCELED' and existing.period_end<=now()) then raise exception 'subscription_conflict'; end if;
  insert into public.store_billing(store_id,environment,plan,status,consumer_id,subscription_id,period_start,period_end,last_invoice_id,billing_interval)
  values(c.store_id,c.environment,c.plan,case when p_refunded>=coalesce(p_amount,c.amount_halalas) then 'FROZEN' else 'ACTIVE' end,c.consumer_id,p_subscription,p_start,p_end,p_invoice,cycle)
  on conflict(store_id,environment) do update set plan=excluded.plan,status=excluded.status,consumer_id=excluded.consumer_id,subscription_id=excluded.subscription_id,
   period_start=excluded.period_start,period_end=excluded.period_end,last_invoice_id=excluded.last_invoice_id,billing_interval=excluded.billing_interval,pending_interval=null,
   included_override=case when excluded.period_start>public.store_billing.period_start then null else public.store_billing.included_override end,updated_at=now()
  where public.store_billing.period_start is null or excluded.period_start>=public.store_billing.period_start;
 end if;
 update public.billing_checkouts set status='PAID' where id=c.id;
 if c.launch_offer then
  if exists(select 1 from public.billing_offers where environment=c.environment and paying_user_id=c.user_id and store_id<>c.store_id and redeemed_at is not null) then raise exception 'offer_already_used'; end if;
  update public.billing_offers set redeemed_at=coalesce(redeemed_at,now()),paying_user_id=c.user_id where store_id=c.store_id and environment=c.environment;
 end if;
end $$;

create or replace function public.billing_snapshot(p_store uuid,p_environment text default 'live') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.store_billing; used_count integer; reserved_count integer; purchased_count integer; spent_count integer; begin
 if coalesce(auth.role(),'anon')<>'service_role' and not exists(select 1 from public.memberships where store_id=p_store and user_id=auth.uid()) then raise exception 'insufficient_permission'; end if;
 select * into b from public.store_billing where store_id=p_store and environment=p_environment;
 select count(*) filter(where state='DELIVERED'),count(*) filter(where state='RESERVED') into used_count,reserved_count from public.billing_message_usage where p_environment='live' and store_id=p_store and bucket='INCLUDED' and period_start=public.billing_month_start(b.period_start,now()) and state<>'FAILED';
 select coalesce(sum(purchased),0) into purchased_count from public.billing_bundle_credits where store_id=p_store and environment=p_environment;
 select count(*) into spent_count from public.billing_message_usage where p_environment='live' and store_id=p_store and bucket='PURCHASED' and state<>'FAILED';
 return jsonb_build_object('plan',b.plan,'status',coalesce(b.status,'SETUP'),'periodStart',b.period_start,'periodEnd',b.period_end,'billingInterval',b.billing_interval,'pendingInterval',b.pending_interval,'allowanceStart',public.billing_month_start(b.period_start,now()),'allowanceEnd',least(b.period_end,public.billing_month_end(b.period_start,now())),'cancelAtPeriodEnd',coalesce(b.cancel_at_period_end,false),'trialUntil',b.trial_until,
 'included',coalesce(case when b.override_period_start=public.billing_month_start(b.period_start,now()) then b.included_override end,case b.plan when 'premium' then 2000 when 'standard' then 500 else 0 end),'used',used_count,'reserved',reserved_count,'purchasedRemaining',greatest(0,purchased_count-spent_count),
 'offerAvailable',exists(select 1 from public.billing_offers where store_id=p_store and environment=p_environment and redeemed_at is null) and not exists(select 1 from public.billing_payments where store_id=p_store and environment=p_environment),
 'enforcementEnabled',(select enforcement_enabled from public.billing_settings where id), 'bundlePriceHalalas',(select bundle_price_halalas from public.billing_settings where id));
end $$;
revoke all on function public.billing_snapshot(uuid,text) from public,anon;
grant execute on function public.billing_snapshot(uuid,text) to authenticated,service_role;

create or replace function public.billing_reserve_message(p_store uuid,p_key text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.store_billing; settings public.billing_settings; existing public.billing_message_usage; used integer; credits integer; spent integer; allowance integer; result uuid; bucket_name text; begin
 perform pg_advisory_xact_lock(hashtext(p_store::text||'live'));
 select * into existing from public.billing_message_usage where message_key=p_key;
 if found then
  if existing.store_id<>p_store then raise exception 'usage_store_mismatch'; end if;
  if existing.state='FAILED' then delete from public.billing_message_usage where id=existing.id; else return existing.id; end if;
 end if;
 select * into settings from public.billing_settings where id;
 select * into b from public.store_billing where store_id=p_store and environment='live';
 if not settings.enforcement_enabled or b.trial_until>now() then bucket_name:='UNMETERED';
 else
  if b.status is null or b.status not in ('ACTIVE','PAST_DUE','CANCELED') or b.period_start is null or b.period_start>now() or b.period_end is null or b.period_end<=now() then raise exception 'subscription_required'; end if;
  allowance:=coalesce(case when b.override_period_start=public.billing_month_start(b.period_start,now()) then b.included_override end,case b.plan when 'premium' then 2000 else 500 end);
  select count(*) into used from public.billing_message_usage where store_id=p_store and bucket='INCLUDED' and period_start=public.billing_month_start(b.period_start,now()) and state<>'FAILED';
  bucket_name:='INCLUDED';
  if used>=allowance then
   if b.plan<>'premium' then raise exception 'upgrade_required'; end if;
   select coalesce(sum(purchased),0) into credits from public.billing_bundle_credits where store_id=p_store and environment='live';
   select count(*) into spent from public.billing_message_usage where store_id=p_store and bucket='PURCHASED' and state<>'FAILED';
   if spent>=credits then raise exception 'message_limit_reached'; end if;
   bucket_name:='PURCHASED';
  end if;
 end if;
 insert into public.billing_message_usage(store_id,message_key,period_start,bucket) values(p_store,p_key,coalesce(public.billing_month_start(b.period_start,now()),date_trunc('month',now())),bucket_name) returning id into result;
 return result;
end $$;

revoke all on function public.billing_start_checkout(uuid,text,uuid,text,text,text),public.billing_apply_invoice(uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.billing_start_checkout(uuid,text,uuid,text,text,text),public.billing_apply_invoice(uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,text,text) to service_role;

-- Serialize frequency changes with checkout/upgrade creation. Unknown provider results stay pending.
create function public.billing_request_interval(p_store uuid,p_environment text,p_user uuid,p_interval text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.store_billing; begin
 if p_interval not in ('monthly','annual') then raise exception 'invalid_interval'; end if;
 perform pg_advisory_xact_lock(hashtext(p_store::text||p_environment));
 if not exists(select 1 from public.memberships where store_id=p_store and user_id=p_user and role in ('owner','admin')) then raise exception 'insufficient_permission'; end if;
 select * into b from public.store_billing where store_id=p_store and environment=p_environment;
 if b.status is distinct from 'ACTIVE' or b.period_end<=now() or b.subscription_id is null or b.cancel_at_period_end then raise exception 'subscription_required'; end if;
 if b.pending_interval is not null and b.pending_interval<>p_interval then raise exception 'change_in_progress'; end if;
 if exists(select 1 from public.billing_checkouts where store_id=p_store and environment=p_environment and status in ('CREATING','READY','REVIEW')) then raise exception 'checkout_in_progress'; end if;
 update public.store_billing set pending_interval=p_interval,updated_at=now() where store_id=p_store and environment=p_environment;
end $$;
revoke all on function public.billing_request_interval(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.billing_request_interval(uuid,text,uuid,text) to service_role;
