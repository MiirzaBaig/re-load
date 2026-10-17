-- Never expire an unresolved payment into a second charge. Reconcile first.
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
 if p_kind='SUBSCRIPTION' and b.subscription_id is not null then raise exception 'subscription_exists'; end if;
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

create or replace function private.dispatch_billing_reconciliation() returns void
language plpgsql security definer set search_path='' as $$
declare ticket uuid:=gen_random_uuid(); begin
 if not exists(select 1 from public.streampay_webhook_events where processing_status in ('RECEIVED','FAILED') and processing_attempts<12 and received_at>now()-interval '7 days')
 and not exists(select 1 from public.store_billing where subscription_id is not null and updated_at<now()-interval '1 hour')
 and not exists(select 1 from public.billing_checkouts where status in ('READY','REVIEW') and payment_link_id is not null and created_at>now()-interval '7 days' and created_at<now()-interval '2 minutes') then return; end if;
 insert into private.whatsapp_worker_tickets values(ticket,now()+interval '5 minutes');
 perform net.http_post(url:='https://clwczcvxosudfevjznmk.supabase.co/functions/v1/billing-reconcile',headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('ticket',ticket),timeout_milliseconds:=60000);
end $$;
