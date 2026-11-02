-- Retain expired sandbox checkout references and allow verified replacement.
-- Never use this procedure for a live checkout or as proof that money was refunded.
alter table private.shipping_topups drop constraint shipping_topups_state_check;
alter table private.shipping_topups add constraint shipping_topups_state_check check(state in ('CREATING','PREPARING','READY','REVIEW','PAID','REFUND_REVIEW','EXPIRED_UNPAID'));
create function public.shipping_topup_retire_expired(p_store uuid,p_id uuid,p_user uuid,p_link uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare t private.shipping_topups;
begin
 if p_store is null or p_id is null or p_user is null or p_link is null then raise exception 'invalid_checkout';end if;
 perform pg_advisory_xact_lock(hashtext('shipping_topup_start'),hashtext(p_store::text));
 select * into t from private.shipping_topups where id=p_id and store_id=p_store and environment='sandbox' for update;
 if not found or t.payment_link_id is distinct from p_link then raise exception 'checkout_mismatch';end if;
 if not exists(select 1 from public.memberships where store_id=p_store and user_id=p_user and role in ('owner','admin')) then raise exception 'insufficient_permission';end if;
 if t.state='EXPIRED_UNPAID' then return false;end if;
 if t.state<>'READY' or t.invoice_id is not null or t.expires_at>now()-interval '5 minutes' then raise exception 'checkout_needs_review';end if;
 -- Service verifier first checks the provider link, collection amount and invoices.
 update private.shipping_topups set state='EXPIRED_UNPAID',updated_at=now() where id=p_id;
 return true;
end $$;
revoke all on function public.shipping_topup_retire_expired(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.shipping_topup_retire_expired(uuid,uuid,uuid,uuid) to service_role;

create or replace function public.shipping_topup_complete(p_id uuid,p_invoice uuid,p_link uuid,p_consumer uuid,p_product uuid,p_amount integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare t private.shipping_topups; credited boolean;
begin
 if p_id is null or p_invoice is null or p_link is null or p_consumer is null or p_product is null or p_amount is null then raise exception 'invalid_payment';end if;
 select * into t from private.shipping_topups where id=p_id for update;
 if not found or t.payment_link_id is distinct from p_link or t.consumer_id is distinct from p_consumer or t.product_id is distinct from p_product or t.amount_halalas<>p_amount or t.state not in ('READY','REVIEW','PAID','EXPIRED_UNPAID') then raise exception 'payment_binding_mismatch';end if;
 if t.invoice_id is not null and t.invoice_id<>p_invoice then raise exception 'invoice_mismatch';end if;
 credited:=public.shipping_apply_verified_topup(t.store_id,'sandbox','stream:'||p_invoice::text,p_amount);
 update private.shipping_topups set state='PAID',invoice_id=p_invoice,updated_at=now() where id=p_id;
 return credited;
end $$;

-- Keep retired references in recovery so delayed successful payments are still credited once.
create or replace function public.shipping_topup_recovery_list() returns jsonb
language sql security definer set search_path='' as $$ select coalesce(jsonb_agg(jsonb_build_object('paymentLinkId',t.payment_link_id,'storeId',t.store_id)),'[]'::jsonb) from(select * from private.shipping_topups where payment_link_id is not null and state in ('READY','REVIEW','EXPIRED_UNPAID') and created_at>now()-interval '7 days' and created_at<now()-interval '2 minutes' order by updated_at limit 5)t $$;
