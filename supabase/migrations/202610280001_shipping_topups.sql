-- Sandbox only. Separate payment attempts; does not change subscription billing.
create table private.shipping_topups (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id), user_id uuid not null,
 environment text not null default 'sandbox' check(environment='sandbox'),
 amount_halalas integer not null check(amount_halalas between 100 and 10000000),
 state text not null default 'CREATING' check(state in ('CREATING','PREPARING','READY','REVIEW','PAID','REFUND_REVIEW')),
 consumer_id uuid, product_id uuid, payment_link_id uuid, invoice_id uuid,
 checkout_url text check(length(checkout_url)<=2048),
 review_code text check(review_code in ('creation_unknown','refund_detected')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '30 minutes',
 updated_at timestamptz not null default now(),
 unique(environment,payment_link_id),unique(environment,invoice_id)
);
create unique index shipping_topup_one_open on private.shipping_topups(store_id,environment) where state in ('CREATING','PREPARING','READY','REVIEW','REFUND_REVIEW');
alter table private.shipping_topups enable row level security;
revoke all on private.shipping_topups from public,anon,authenticated,service_role;

create function public.shipping_topup_start(p_store uuid,p_user uuid,p_amount integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t private.shipping_topups;
begin
 if p_store is null or p_user is null or p_amount is null or p_amount not between 100 and 10000000 then raise exception 'invalid_topup';end if;
 if not exists(select 1 from public.memberships where store_id=p_store and user_id=p_user and role in ('owner','admin')) then raise exception 'insufficient_permission' using errcode='42501';end if;
 if not exists(select 1 from public.store_billing where store_id=p_store and environment='sandbox' and plan='premium' and status='ACTIVE' and period_start<=now() and period_end>now()) then raise exception 'premium_required';end if;
 perform pg_advisory_xact_lock(hashtext('shipping_topup_start'),hashtext(p_store::text));
 if exists(select 1 from private.shipping_wallets where store_id=p_store and environment='sandbox' and on_hold) then raise exception 'shipping_wallet_review';end if;
 select * into t from private.shipping_topups where store_id=p_store and environment='sandbox' and state in ('CREATING','PREPARING','READY','REVIEW','REFUND_REVIEW');
 if found then
  if t.amount_halalas<>p_amount or t.user_id<>p_user then raise exception 'topup_pending';end if;
  return to_jsonb(t);
 end if;
 insert into private.shipping_topups(store_id,user_id,amount_halalas) values(p_store,p_user,p_amount) returning * into t;
 return to_jsonb(t);
end $$;
create function public.shipping_topup_claim(p_id uuid,p_store uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update private.shipping_topups set state='PREPARING',updated_at=now() where id=p_id and store_id=p_store and state='CREATING';
 return found;
end $$;
create function public.shipping_topup_bind(p_id uuid,p_store uuid,p_consumer uuid,p_product uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_consumer is null or p_product is null then raise exception 'invalid_binding';end if;
 update private.shipping_topups set consumer_id=p_consumer,product_id=p_product,updated_at=now()
 where id=p_id and store_id=p_store and state='PREPARING' and (consumer_id is null or consumer_id=p_consumer) and (product_id is null or product_id=p_product);
 if not found then raise exception 'topup_binding_mismatch';end if;
end $$;
create function public.shipping_topup_note_link(p_id uuid,p_store uuid,p_link uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_link is null then raise exception 'invalid_checkout_link';end if;
 update private.shipping_topups set payment_link_id=p_link,updated_at=now() where id=p_id and store_id=p_store and state='PREPARING' and (payment_link_id is null or payment_link_id=p_link);
 if not found then raise exception 'topup_binding_mismatch';end if;
end $$;
create function public.shipping_topup_ready(p_id uuid,p_store uuid,p_link uuid,p_url text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_link is null or p_url is null or length(p_url)>2048 or p_url !~ '^https://([a-zA-Z0-9-]+\.)*streampay\.sa/' then raise exception 'invalid_checkout_link';end if;
 update private.shipping_topups set state='READY',payment_link_id=p_link,checkout_url=p_url,updated_at=now()
 where id=p_id and store_id=p_store and state='PREPARING' and payment_link_id=p_link and consumer_id is not null and product_id is not null;
 if not found then raise exception 'topup_binding_mismatch';end if;
end $$;
create function public.shipping_topup_review(p_id uuid,p_store uuid,p_code text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_code is distinct from 'creation_unknown' then raise exception 'invalid_review';end if;
 update private.shipping_topups set state='REVIEW',review_code=p_code,updated_at=now() where id=p_id and store_id=p_store and state in ('CREATING','PREPARING');
end $$;
create function public.shipping_topup_by_link(p_link uuid) returns jsonb
language sql security definer set search_path='' as $$ select to_jsonb(t) from private.shipping_topups t where t.environment='sandbox' and t.payment_link_id=p_link $$;
create function public.shipping_topup_pending(p_store uuid) returns jsonb
language sql security definer set search_path='' as $$ select to_jsonb(t) from private.shipping_topups t where t.store_id=p_store and t.environment='sandbox' order by t.created_at desc,t.id desc limit 1 $$;
create function public.shipping_topup_recovery_list() returns jsonb
language sql security definer set search_path='' as $$ select coalesce(jsonb_agg(jsonb_build_object('paymentLinkId',t.payment_link_id,'storeId',t.store_id)),'[]'::jsonb) from(select * from private.shipping_topups where payment_link_id is not null and state in ('READY','REVIEW') and created_at>now()-interval '7 days' and created_at<now()-interval '2 minutes' order by created_at limit 5)t $$;

-- Authoritative matching is performed by the server verifier BEFORE this atomic credit.
create function public.shipping_topup_complete(p_id uuid,p_invoice uuid,p_link uuid,p_consumer uuid,p_product uuid,p_amount integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare t private.shipping_topups; credited boolean;
begin
 if p_id is null or p_invoice is null or p_link is null or p_consumer is null or p_product is null or p_amount is null then raise exception 'invalid_payment';end if;
 select * into t from private.shipping_topups where id=p_id for update;
 if not found or t.payment_link_id is distinct from p_link or t.consumer_id is distinct from p_consumer or t.product_id is distinct from p_product or t.amount_halalas<>p_amount or t.state not in ('READY','REVIEW','PAID') then raise exception 'payment_binding_mismatch';end if;
 if t.invoice_id is not null and t.invoice_id<>p_invoice then raise exception 'invoice_mismatch';end if;
 credited:=public.shipping_apply_verified_topup(t.store_id,'sandbox','stream:'||p_invoice::text,p_amount);
 update private.shipping_topups set state='PAID',invoice_id=p_invoice,updated_at=now() where id=p_id;
 return credited;
end $$;
create function public.shipping_topup_refund_review(p_id uuid,p_invoice uuid) returns void
language plpgsql security definer set search_path='' as $$
declare t private.shipping_topups;
begin
 select * into t from private.shipping_topups where id=p_id for update;
 if not found or t.invoice_id is distinct from p_invoice or t.state not in ('PAID','REFUND_REVIEW') then raise exception 'refund_binding_mismatch';end if;
 update private.shipping_wallets set on_hold=true,updated_at=now() where store_id=t.store_id and environment='sandbox';
 update private.shipping_topups set state='REFUND_REVIEW',review_code='refund_detected',updated_at=now() where id=t.id;
end $$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'shipping_topup_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
