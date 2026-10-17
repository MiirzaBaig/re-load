-- Billing writes are server-only. Sandbox can never authorize the production assistant.
create table public.billing_settings (
 id boolean primary key default true check(id), enforcement_enabled boolean not null default false,
 bundle_price_halalas integer check(bundle_price_halalas > 0), updated_at timestamptz not null default now()
);
insert into public.billing_settings(id) values(true);
create table public.store_billing (
 store_id uuid not null references public.stores(id), environment text not null check(environment in ('sandbox','live')),
 plan text check(plan in ('standard','premium')), status text not null default 'SETUP' check(status in ('SETUP','ACTIVE','PAST_DUE','CANCELED','FROZEN')),
 consumer_id uuid, subscription_id uuid, period_start timestamptz, period_end timestamptz,
 cancel_at_period_end boolean not null default false, included_override integer, last_invoice_id uuid,
 trial_until timestamptz, updated_at timestamptz not null default now(),
 primary key(store_id,environment), unique(environment,subscription_id)
);
create table public.billing_offers (
 store_id uuid not null references public.stores(id), environment text not null check(environment in ('sandbox','live')), granted_by uuid not null references auth.users(id),
 granted_at timestamptz not null default now(), redeemed_at timestamptz, paying_user_id uuid references auth.users(id), primary key(store_id,environment)
);
create table public.billing_checkouts (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id),
 environment text not null check(environment in ('sandbox','live')), user_id uuid not null references auth.users(id),
 plan text not null check(plan in ('standard','premium')), kind text not null default 'SUBSCRIPTION' check(kind in ('SUBSCRIPTION','BUNDLE','UPGRADE')),
 amount_halalas integer not null check(amount_halalas > 0), launch_offer boolean not null default false,
 product_id uuid, target_product_id uuid, consumer_id uuid, payment_link_id uuid, checkout_url text,
 upgrade_subscription_id uuid, upgrade_period_start timestamptz, upgrade_period_end timestamptz, upgrade_messages integer,
 status text not null default 'CREATING' check(status in ('CREATING','READY','PAID','FAILED','REVIEW')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '30 minutes',
 unique(environment,payment_link_id)
);
create unique index billing_one_open_checkout on public.billing_checkouts(store_id,environment) where status in ('CREATING','READY','REVIEW');
create table public.billing_payments (
 environment text not null, invoice_id uuid not null, store_id uuid not null references public.stores(id),
 subscription_id uuid, plan text not null, amount_halalas integer not null, refunded_halalas integer not null default 0,
 kind text not null default 'SUBSCRIPTION', period_start timestamptz, period_end timestamptz, paid_at timestamptz not null default now(),
 primary key(environment,invoice_id)
);
create table public.billing_message_usage (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id),
 message_key text not null unique, external_message_id text unique, period_start timestamptz not null,
 bucket text not null check(bucket in ('INCLUDED','PURCHASED','UNMETERED')),
 state text not null default 'RESERVED' check(state in ('RESERVED','DELIVERED','FAILED')),
 category text not null default 'service', created_at timestamptz not null default now(), delivered_at timestamptz
);
create index billing_usage_store_period on public.billing_message_usage(store_id,period_start,state);
create table public.billing_bundle_credits (
 store_id uuid not null references public.stores(id), environment text not null,
 invoice_id uuid not null, purchased integer not null check(purchased > 0), primary key(environment,invoice_id)
);
create table public.billing_cost_events (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id),
 provider text not null, operation text not null, input_tokens integer not null default 0,
 output_tokens integer not null default 0, model text, cost_sar numeric(14,6),
 cost_basis text not null default 'UNPRICED' check(cost_basis in ('UNPRICED','ESTIMATE','INVOICE')),
 created_at timestamptz not null default now()
);
-- Separate namespace prevents a sandbox notification from entering live reconciliation.
alter table public.streampay_webhook_events add column environment text not null default 'live' check(environment in ('sandbox','live'));
alter table public.streampay_webhook_events drop constraint streampay_webhook_events_payload_digest_key;
alter table public.streampay_webhook_events add unique(environment,payload_digest);

-- New tables deliberately have no merchant write policies.
do $$ declare t text; begin
 foreach t in array array['billing_settings','store_billing','billing_offers','billing_checkouts','billing_payments','billing_message_usage','billing_bundle_credits','billing_cost_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

create function public.billing_snapshot(p_store uuid,p_environment text default 'live') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.store_billing; used_count integer; reserved_count integer; purchased_count integer; spent_count integer; begin
 if coalesce(auth.role(),'anon')<>'service_role' and not exists(select 1 from public.memberships where store_id=p_store and user_id=auth.uid()) then raise exception 'insufficient_permission'; end if;
 select * into b from public.store_billing where store_id=p_store and environment=p_environment;
 select count(*) filter(where state='DELIVERED'),count(*) filter(where state='RESERVED') into used_count,reserved_count from public.billing_message_usage where p_environment='live' and store_id=p_store and bucket='INCLUDED' and period_start=b.period_start and state<>'FAILED';
 select coalesce(sum(purchased),0) into purchased_count from public.billing_bundle_credits where store_id=p_store and environment=p_environment;
 select count(*) into spent_count from public.billing_message_usage where p_environment='live' and store_id=p_store and bucket='PURCHASED' and state<>'FAILED';
 return jsonb_build_object('plan',b.plan,'status',coalesce(b.status,'SETUP'),'periodStart',b.period_start,'periodEnd',b.period_end,'cancelAtPeriodEnd',coalesce(b.cancel_at_period_end,false),'trialUntil',b.trial_until,
 'included',coalesce(b.included_override,case b.plan when 'premium' then 2000 when 'standard' then 500 else 0 end),'used',used_count,'reserved',reserved_count,'purchasedRemaining',greatest(0,purchased_count-spent_count),
 'offerAvailable',exists(select 1 from public.billing_offers where store_id=p_store and environment=p_environment and redeemed_at is null) and not exists(select 1 from public.billing_payments where store_id=p_store and environment=p_environment),
 'enforcementEnabled',(select enforcement_enabled from public.billing_settings where id), 'bundlePriceHalalas',(select bundle_price_halalas from public.billing_settings where id));
end $$;
revoke all on function public.billing_snapshot(uuid,text) from public,anon;
grant execute on function public.billing_snapshot(uuid,text) to authenticated,service_role;

create function public.billing_grant_offer(p_store uuid,p_environment text default 'live') returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not private.platform_mfa_verified() or not exists(select 1 from public.platform_admins where user_id=auth.uid() and role='owner') then raise exception 'insufficient_permission'; end if;
 perform pg_advisory_xact_lock(hashtext('reload_founding_offer'));
 if exists(select 1 from public.billing_payments where store_id=p_store and environment=p_environment) then raise exception 'already_paid'; end if;
 if exists(select 1 from public.billing_offers where store_id=p_store and environment=p_environment) then return; end if;
 if (select count(distinct m.user_id) from public.billing_payments p join public.memberships m on m.store_id=p.store_id and m.role='owner' where p.environment=p_environment)>=30 then raise exception 'offer_closed'; end if;
 if (select count(*) from public.billing_offers where environment=p_environment)>=30 then raise exception 'offer_limit'; end if;
 insert into public.billing_offers(store_id,environment,granted_by) values(p_store,p_environment,auth.uid());
 insert into public.platform_admin_events(actor_user_id,event_type,entity_type,entity_id) values(auth.uid(),'BILLING_OFFER_GRANTED','store',p_store);
end $$;
revoke all on function public.billing_grant_offer(uuid,text) from public,anon;
grant execute on function public.billing_grant_offer(uuid,text) to authenticated;

create function public.billing_apply_invoice(p_checkout uuid,p_invoice uuid,p_subscription uuid,p_start timestamptz,p_end timestamptz,p_refunded integer default 0,p_amount integer default null,p_plan text default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.billing_checkouts; existing public.store_billing; begin
 select * into c from public.billing_checkouts where id=p_checkout for update;
 if not found or c.status not in ('READY','PAID') then raise exception 'checkout_not_ready'; end if;
 if p_plan is not null then
  if p_plan not in ('standard','premium') then raise exception 'invalid_plan'; end if;
  c.plan:=p_plan;
 end if;
 perform pg_advisory_xact_lock(hashtext(c.store_id::text||c.environment));
 if c.launch_offer then
  perform pg_advisory_xact_lock(hashtext('reload_founding_offer'));
  if not exists(select 1 from public.billing_offers where store_id=c.store_id and environment=c.environment) then raise exception 'offer_missing'; end if;
 end if;
 insert into public.billing_payments(environment,invoice_id,store_id,subscription_id,plan,amount_halalas,kind,refunded_halalas,period_start,period_end)
 values(c.environment,p_invoice,c.store_id,p_subscription,c.plan,coalesce(p_amount,c.amount_halalas),c.kind,p_refunded,p_start,p_end)
 on conflict(environment,invoice_id) do update set refunded_halalas=excluded.refunded_halalas;
 if c.kind='UPGRADE' then
  select * into existing from public.store_billing where store_id=c.store_id and environment=c.environment for update;
  if existing.subscription_id<>c.upgrade_subscription_id or existing.period_start<>c.upgrade_period_start then raise exception 'upgrade_period_changed'; end if;
  if p_refunded>0 then raise exception 'upgrade_refund_requires_review'; end if;
  update public.store_billing set plan='premium',included_override=500+c.upgrade_messages,updated_at=now() where store_id=c.store_id and environment=c.environment;
 elsif c.kind='BUNDLE' then
  if p_refunded>0 then raise exception 'bundle_refund_requires_review'; end if;
  insert into public.billing_bundle_credits(store_id,environment,invoice_id,purchased) values(c.store_id,c.environment,p_invoice,2000) on conflict do nothing;
 else
  if p_subscription is null or p_start is null or p_end<=p_start or p_end>p_start+interval '40 days' then raise exception 'invalid_period'; end if;
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

-- Reserve before AI/send, and settle on Meta delivery. Unknown outcomes remain reserved.
create function public.billing_reserve_message(p_store uuid,p_key text) returns uuid
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
  allowance:=coalesce(b.included_override,case b.plan when 'premium' then 2000 else 500 end);
  select count(*) into used from public.billing_message_usage where store_id=p_store and bucket='INCLUDED' and period_start=b.period_start and state<>'FAILED';
  bucket_name:='INCLUDED';
  if used>=allowance then
   if b.plan<>'premium' then raise exception 'upgrade_required'; end if;
   select coalesce(sum(purchased),0) into credits from public.billing_bundle_credits where store_id=p_store and environment='live';
   select count(*) into spent from public.billing_message_usage where store_id=p_store and bucket='PURCHASED' and state<>'FAILED';
   if spent>=credits then raise exception 'message_limit_reached'; end if;
   bucket_name:='PURCHASED';
  end if;
 end if;
 insert into public.billing_message_usage(store_id,message_key,period_start,bucket) values(p_store,p_key,coalesce(b.period_start,date_trunc('month',now())),bucket_name) returning id into result;
 return result;
end $$;
create function public.billing_settle_message(p_external text,p_status text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_status not in ('DELIVERED','READ','FAILED') then return; end if;
 update public.billing_message_usage set state=case when p_status='FAILED' then 'FAILED' else 'DELIVERED' end,
 delivered_at=case when p_status in ('DELIVERED','READ') then coalesce(delivered_at,now()) else delivered_at end
 where external_message_id=p_external and (state='RESERVED' or p_status in ('DELIVERED','READ'));
end $$;
revoke all on function public.billing_apply_invoice(uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,text) from public,anon,authenticated;
revoke all on function public.billing_reserve_message(uuid,text) from public,anon,authenticated;
revoke all on function public.billing_settle_message(text,text) from public,anon,authenticated;
grant execute on function public.billing_apply_invoice(uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,text), public.billing_reserve_message(uuid,text), public.billing_settle_message(text,text) to service_role;
create table public.billing_catalog (
 environment text not null check(environment in ('sandbox','live')), plan text not null check(plan in ('standard','premium')),
 product_id uuid not null, coupon_id uuid, primary key(environment,plan)
);
alter table public.billing_catalog enable row level security;
revoke all on public.billing_catalog from public,anon,authenticated;
grant all on public.billing_catalog to service_role;
create function public.billing_start_checkout(p_store uuid,p_environment text,p_user uuid,p_plan text,p_kind text default 'SUBSCRIPTION') returns public.billing_checkouts
language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.store_billing; c public.billing_checkouts; amount integer; offer boolean; fraction numeric; begin
 perform pg_advisory_xact_lock(hashtext(p_store::text||p_environment));
 if not exists(select 1 from public.memberships where store_id=p_store and user_id=p_user and role in ('owner','admin')) then raise exception 'insufficient_permission'; end if;
 update public.billing_checkouts set status='FAILED' where store_id=p_store and environment=p_environment and status in ('CREATING','READY') and expires_at<now();
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
revoke all on function public.billing_start_checkout(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.billing_start_checkout(uuid,text,uuid,text,text) to service_role;
alter table public.streampay_webhook_events add column invoice_id uuid, add column subscription_id uuid;
-- Delivery callbacks may precede send receipt persistence. Save callback state first.
create table public.billing_delivery_receipts (
 external_message_id text primary key, state text not null check(state in ('DELIVERED','FAILED')),
 received_at timestamptz not null default now()
);
alter table public.billing_delivery_receipts enable row level security;
revoke all on public.billing_delivery_receipts from public,anon,authenticated;
grant all on public.billing_delivery_receipts to service_role;
create or replace function public.billing_settle_message(p_external text,p_status text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare next_state text; begin
 if p_status not in ('DELIVERED','READ','FAILED') or length(p_external) not between 1 and 512 then return; end if;
 insert into public.billing_delivery_receipts(external_message_id,state) values(p_external,case when p_status='FAILED' then 'FAILED' else 'DELIVERED' end)
 on conflict(external_message_id) do update set state=case when public.billing_delivery_receipts.state='DELIVERED' then 'DELIVERED' else excluded.state end;
 select state into next_state from public.billing_delivery_receipts where external_message_id=p_external;
 update public.billing_message_usage set state=next_state,delivered_at=case when next_state='DELIVERED' then coalesce(delivered_at,now()) else delivered_at end where external_message_id=p_external;
end $$;
create function private.billing_link_receipt() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare receipt text; begin
 if new.external_message_id is not null then
  select state into receipt from public.billing_delivery_receipts where external_message_id=new.external_message_id;
  if receipt is not null then new.state:=receipt; if receipt='DELIVERED' then new.delivered_at:=coalesce(new.delivered_at,now()); end if; end if;
 end if;
 return new;
end $$;
create trigger billing_link_delivery before insert or update of external_message_id on public.billing_message_usage for each row execute function private.billing_link_receipt();
