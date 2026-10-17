-- A cancelled store can subscribe again after its paid period ends.
create or replace function public.billing_start_checkout(p_store uuid,p_environment text,p_user uuid,p_plan text,p_kind text default 'SUBSCRIPTION') returns public.billing_checkouts
language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.store_billing; c public.billing_checkouts; amount integer; offer boolean; fraction numeric; begin
 perform pg_advisory_xact_lock(hashtext(p_store::text||p_environment));
 if not exists(select 1 from public.memberships where store_id=p_store and user_id=p_user and role in ('owner','admin')) then raise exception 'insufficient_permission'; end if;
 update public.billing_checkouts set status='REVIEW' where store_id=p_store and environment=p_environment and status in ('CREATING','READY') and expires_at<now();
 select * into c from public.billing_checkouts where store_id=p_store and environment=p_environment and status in ('CREATING','READY','REVIEW');
 if found then
  if c.plan<>p_plan or c.kind<>p_kind then raise exception 'checkout_in_progress'; end if;
  return c;
 end if;
 select * into b from public.store_billing where store_id=p_store and environment=p_environment;
 if p_kind='SUBSCRIPTION' and b.subscription_id is not null and (b.status<>'CANCELED' or b.period_end>now()) then raise exception 'subscription_exists'; end if;
 if p_kind='UPGRADE' then
  if b.plan is distinct from 'standard' or b.status<>'ACTIVE' or b.period_end<=now() or b.period_start>now() then raise exception 'upgrade_not_available'; end if;
  if p_plan<>'premium' then raise exception 'invalid_plan'; end if;
  fraction:=extract(epoch from (b.period_end-now()))/extract(epoch from (b.period_end-b.period_start));
  amount:=ceil(15000*fraction); offer:=false;
  if amount<100 then raise exception 'upgrade_too_close_to_renewal'; end if;
 elsif p_kind='BUNDLE' then
  if b.plan is null or b.plan<>'premium' or b.status<>'ACTIVE' or b.period_end<=now() then raise exception 'premium_required'; end if;
  select bundle_price_halalas into amount from public.billing_settings where id;
  if amount is null then raise exception 'bundles_not_available'; end if;
  offer:=false;
 else
  if p_plan not in ('standard','premium') then raise exception 'invalid_plan'; end if;
  perform pg_advisory_xact_lock(hashtext('reload_founding_offer'));
  offer:=exists(select 1 from public.billing_offers where store_id=p_store and environment=p_environment and redeemed_at is null)
   and not exists(select 1 from public.billing_payments where store_id=p_store and environment=p_environment)
   and not exists(select 1 from public.billing_offers where environment=p_environment and paying_user_id=p_user and store_id<>p_store and redeemed_at is not null)
   and not exists(select 1 from public.billing_checkouts where environment=p_environment and user_id=p_user and store_id<>p_store and launch_offer and status in ('CREATING','READY','REVIEW'));
  amount:=case p_plan when 'standard' then case when offer then 9900 else 14900 end else case when offer then 19900 else 29900 end end;
 end if;
 insert into public.billing_checkouts(store_id,environment,user_id,plan,kind,amount_halalas,launch_offer,upgrade_subscription_id,upgrade_period_start,upgrade_period_end,upgrade_messages)
 values(p_store,p_environment,p_user,p_plan,p_kind,amount,offer,case when p_kind='UPGRADE' then b.subscription_id end,case when p_kind='UPGRADE' then b.period_start end,case when p_kind='UPGRADE' then b.period_end end,case when p_kind='UPGRADE' then floor(1500*fraction)::integer end) returning * into c;
 return c;
end $$;


create or replace function public.billing_apply_invoice(p_checkout uuid,p_invoice uuid,p_subscription uuid,p_start timestamptz,p_end timestamptz,p_refunded integer default 0,p_amount integer default null,p_plan text default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.billing_checkouts; existing public.store_billing; payment public.billing_payments; begin
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
 if c.launch_offer then
  perform pg_advisory_xact_lock(hashtext('reload_founding_offer'));
  if not exists(select 1 from public.billing_offers where store_id=c.store_id and environment=c.environment) then raise exception 'offer_missing'; end if;
 end if;
 insert into public.billing_payments(environment,invoice_id,store_id,subscription_id,plan,amount_halalas,kind,refunded_halalas,period_start,period_end)
 values(c.environment,p_invoice,c.store_id,p_subscription,c.plan,coalesce(p_amount,c.amount_halalas),c.kind,p_refunded,p_start,p_end);
 if c.kind='UPGRADE' then
  select * into existing from public.store_billing where store_id=c.store_id and environment=c.environment for update;
  if existing.subscription_id is distinct from c.upgrade_subscription_id or existing.period_start is distinct from c.upgrade_period_start then raise exception 'upgrade_period_changed'; end if;
  if p_refunded>0 then raise exception 'upgrade_refund_requires_review'; end if;
  update public.store_billing set plan='premium',included_override=500+c.upgrade_messages,updated_at=now() where store_id=c.store_id and environment=c.environment;
 elsif c.kind='BUNDLE' then
  if p_refunded>0 then raise exception 'bundle_refund_requires_review'; end if;
  insert into public.billing_bundle_credits(store_id,environment,invoice_id,purchased) values(c.store_id,c.environment,p_invoice,2000) on conflict do nothing;
 else
  if p_subscription is null or p_start is null or p_end is null or p_end<=p_start or p_end>p_start+interval '40 days' then raise exception 'invalid_period'; end if;
  select * into existing from public.store_billing where store_id=c.store_id and environment=c.environment for update;
  if existing.subscription_id is not null and existing.subscription_id<>p_subscription and not (existing.status='CANCELED' and existing.period_end<=now()) then raise exception 'subscription_conflict'; end if;
  insert into public.store_billing(store_id,environment,plan,status,consumer_id,subscription_id,period_start,period_end,last_invoice_id)
  values(c.store_id,c.environment,c.plan,case when p_refunded>=coalesce(p_amount,c.amount_halalas) then 'FROZEN' else 'ACTIVE' end,c.consumer_id,p_subscription,p_start,p_end,p_invoice)
  on conflict(store_id,environment) do update set plan=excluded.plan,status=excluded.status,consumer_id=excluded.consumer_id,subscription_id=excluded.subscription_id,
   period_start=excluded.period_start,period_end=excluded.period_end,last_invoice_id=excluded.last_invoice_id,
   included_override=case when excluded.period_start>public.store_billing.period_start then null else public.store_billing.included_override end,updated_at=now()
  where public.store_billing.period_start is null or excluded.period_start>=public.store_billing.period_start;
 end if;
 update public.billing_checkouts set status='PAID' where id=c.id;
 if c.launch_offer then
  if exists(select 1 from public.billing_offers where environment=c.environment and paying_user_id=c.user_id and store_id<>c.store_id and redeemed_at is not null) then raise exception 'offer_already_used'; end if;
  update public.billing_offers set redeemed_at=coalesce(redeemed_at,now()),paying_user_id=c.user_id where store_id=c.store_id and environment=c.environment;
 end if;
end $$;
