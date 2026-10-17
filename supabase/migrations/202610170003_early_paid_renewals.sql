-- A confirmed future renewal is recorded now, and starts only at its paid boundary.
create function private.billing_activate_due(p_store uuid,p_environment text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.store_billing; p public.billing_payments; begin
 perform pg_advisory_xact_lock(hashtext(p_store::text||p_environment));
 select * into b from public.store_billing where store_id=p_store and environment=p_environment for update;
 if not found or b.status='FROZEN' then return; end if;
 select * into p from public.billing_payments where store_id=p_store and environment=p_environment
  and kind='SUBSCRIPTION' and subscription_id=b.subscription_id and refunded_halalas<amount_halalas
  and period_start>b.period_start and period_start<=now() and period_end>now() order by period_start desc limit 1;
 if not found then return; end if;
 update public.store_billing set plan=p.plan,billing_interval=p.billing_interval,status='ACTIVE',period_start=p.period_start,period_end=p.period_end,
  last_invoice_id=p.invoice_id,included_override=null,override_period_start=null,pending_interval=null,updated_at=now()
  where store_id=p_store and environment=p_environment;
end $$;
revoke all on function private.billing_activate_due(uuid,text) from public,anon,authenticated;
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
  if not coalesce(p_start>now() and existing.period_end>now(),false) then
  insert into public.store_billing(store_id,environment,plan,status,consumer_id,subscription_id,period_start,period_end,last_invoice_id,billing_interval)
  values(c.store_id,c.environment,c.plan,case when p_refunded>=coalesce(p_amount,c.amount_halalas) then 'FROZEN' else 'ACTIVE' end,c.consumer_id,p_subscription,p_start,p_end,p_invoice,cycle)
  on conflict(store_id,environment) do update set plan=excluded.plan,status=excluded.status,consumer_id=excluded.consumer_id,subscription_id=excluded.subscription_id,
   period_start=excluded.period_start,period_end=excluded.period_end,last_invoice_id=excluded.last_invoice_id,billing_interval=excluded.billing_interval,pending_interval=null,
   included_override=case when excluded.period_start>public.store_billing.period_start then null else public.store_billing.included_override end,updated_at=now()
  where public.store_billing.period_start is null or excluded.period_start>=public.store_billing.period_start;
  end if;
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
 perform private.billing_activate_due(p_store,p_environment);
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
 perform private.billing_activate_due(p_store,'live');
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
