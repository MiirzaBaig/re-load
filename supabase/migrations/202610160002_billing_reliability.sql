-- Replayed paid invoices may update refund evidence but cannot reset plan/allowance.
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
  if existing.subscription_id is not null and existing.subscription_id<>p_subscription then raise exception 'subscription_conflict'; end if;
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

-- Staff may approve finite pilot access explicitly; never silently grandfather all stores.
create function public.billing_grant_pilot(p_store uuid,p_until timestamptz) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not private.platform_mfa_verified() or not exists(select 1 from public.platform_admins where user_id=auth.uid() and role='owner') then raise exception 'insufficient_permission'; end if;
 if p_until<=now() or p_until>now()+interval '30 days' then raise exception 'invalid_pilot_period'; end if;
 insert into public.store_billing(store_id,environment,trial_until) values(p_store,'live',p_until)
 on conflict(store_id,environment) do update set trial_until=excluded.trial_until,updated_at=now();
 insert into public.platform_admin_events(actor_user_id,event_type,entity_type,entity_id) values(auth.uid(),'BILLING_PILOT_GRANTED','store',p_store);
end $$;
revoke all on function public.billing_grant_pilot(uuid,timestamptz) from public,anon;
grant execute on function public.billing_grant_pilot(uuid,timestamptz) to authenticated;

-- Record why a conversation is waiting without displaying billing internals to customers.
create or replace function public.record_journey_issue(p_conversation uuid,p_kind text,p_message text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_kind not in ('order_lookup_unavailable','photo_read_unavailable','billing_waiting') then raise exception 'invalid_issue'; end if;
 insert into private.journey_activity(store_id,conversation_id,kind,step,source_message_id)
 select store_id,id,'issue',p_kind,left(p_message,200) from public.whatsapp_conversations where id=p_conversation on conflict do nothing;
end $$;
