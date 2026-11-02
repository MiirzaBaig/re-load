-- Sandbox only: exact product/quantity packaging approval and atomic booking authorization.
create table private.shipping_parcels(
 store_id uuid not null references public.stores(id),sku text not null check(length(sku) between 1 and 100),quantity integer not null check(quantity between 1 and 20),
 version integer not null default 1,weight_grams integer not null check(weight_grams between 1 and 30000),
 length_mm integer not null check(length_mm between 1 and 1500),width_mm integer not null check(width_mm between 1 and 1500),height_mm integer not null check(height_mm between 1 and 1500),
 approved_by uuid not null,approved_at timestamptz not null default now(),primary key(store_id,sku,quantity)
);
create table private.shipping_automation(
 collection_id uuid primary key references private.shipping_collection_confirmations(id),store_id uuid not null references public.stores(id),
 attempt_id uuid not null unique,settings_version integer not null,parcel_version integer not null,courier_id text not null,
 stage text not null check(stage in ('ORDER_CREATING','ORDER_READY','RETURN_CREATING','RETURN_REQUESTED','UNKNOWN','VERIFIED')),
 order_ref text not null,return_ref text,parcel_snapshot jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table private.shipping_automation_issues(
 collection_id uuid not null references private.shipping_collection_confirmations(id),store_id uuid not null references public.stores(id),
 reason text not null check(reason in ('PARCEL_REQUIRED','ORDER_REVIEW','SETTINGS_CHANGED','COURIER_UNAVAILABLE','ABOVE_CAP','BALANCE_REQUIRED','PROVIDER_FUNDS','PROVIDER_UNAVAILABLE','BOOKING_UNCERTAIN','CHARGE_REVIEW')),
 created_at timestamptz not null default now(),primary key(collection_id,reason)
);
alter table private.shipping_parcels enable row level security;
alter table private.shipping_automation enable row level security;
alter table private.shipping_automation_issues enable row level security;
revoke all on private.shipping_parcels,private.shipping_automation,private.shipping_automation_issues from public,anon,authenticated,service_role;

create function public.shipping_parcel_save(p_store uuid,p_user uuid,p_sku text,p_quantity integer,p_version integer,p_weight integer,p_length integer,p_width integer,p_height integer,p_consent boolean) returns integer
language plpgsql security definer set search_path='' as $$
declare v integer;
begin
 perform private.shipping_settings_writer(p_store,p_user);
 if p_sku is null or length(btrim(p_sku)) not between 1 and 100 or p_sku<>btrim(p_sku) or p_sku~'[<>[:cntrl:]]' or p_quantity is null or p_quantity not between 1 and 20 or p_version is null or p_version<0 or p_weight is null or p_weight not between 1 and 30000 or p_length is null or p_length not between 1 and 1500 or p_width is null or p_width not between 1 and 1500 or p_height is null or p_height not between 1 and 1500 or p_consent is distinct from true then raise exception 'invalid_input';end if;
 perform pg_advisory_xact_lock(hashtext('shipping_parcel'),hashtext(p_store::text));
 select version into v from private.shipping_parcels where store_id=p_store and sku=p_sku and quantity=p_quantity;
 if coalesce(v,0)<>p_version then raise exception 'settings_changed';end if;
 insert into private.shipping_parcels(store_id,sku,quantity,version,weight_grams,length_mm,width_mm,height_mm,approved_by)
 values(p_store,p_sku,p_quantity,p_version+1,p_weight,p_length,p_width,p_height,p_user)
 on conflict(store_id,sku,quantity) do update set version=p_version+1,weight_grams=p_weight,length_mm=p_length,width_mm=p_width,height_mm=p_height,approved_by=p_user,approved_at=now();
 return p_version+1;
end $$;
create function public.shipping_parcel_snapshot(p_store uuid,p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.memberships where store_id=p_store and user_id=p_user) then raise exception 'access_denied';end if;
 return jsonb_build_object('parcels',coalesce((select jsonb_agg(to_jsonb(x)-'approved_by'-'store_id') from(select * from private.shipping_parcels where store_id=p_store order by approved_at desc limit 100)x),'[]'::jsonb),
 'improvements',coalesce((select jsonb_agg(jsonb_build_object('reason',reason,'count',n)) from(select reason,count(*) n from private.shipping_automation_issues where store_id=p_store and created_at>now()-interval '30 days' group by reason)x),'[]'::jsonb));
end $$;
create function public.shipping_automation_read(p_store uuid,p_conversation uuid,p_case uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c private.shipping_collection_confirmations;s private.shipping_settings;sku_value text;qty integer;
begin
 if not private.shipping_collection_binding(p_store,p_conversation,p_case) then raise exception 'access_denied';end if;
 select * into c from private.shipping_collection_confirmations where store_id=p_store and case_id=p_case and conversation_id=p_conversation;
 if c.id is null then return null;end if;
 select * into s from private.shipping_settings where store_id=p_store;
 select item_snapshot->>'sku',(item_snapshot->>'quantity')::integer into sku_value,qty from public.return_cases where id=p_case and store_id=p_store;
 return jsonb_build_object('collection',to_jsonb(c),'settings',to_jsonb(s)-'approved_by',
 'warehouse',(select jsonb_build_object('id',id,'code',provider_code) from private.shipping_warehouses where store_id=p_store and id=coalesce((select a.warehouse_id from private.shipping_attempts a join private.shipping_automation j on j.attempt_id=a.id where j.collection_id=c.id),s.warehouse_id) and environment='sandbox'),
 'parcel',(select to_jsonb(p)-'approved_by' from private.shipping_parcels p where p.store_id=p_store and p.sku=sku_value and p.quantity=qty),
 'booking',(select to_jsonb(a) from private.shipping_automation a where collection_id=c.id),
 'attempt',(select to_jsonb(a) from private.shipping_attempts a join private.shipping_automation j on j.attempt_id=a.id where j.collection_id=c.id));
end $$;
create function public.shipping_automation_issue(p_store uuid,p_conversation uuid,p_case uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.shipping_collection_binding(p_store,p_conversation,p_case) then raise exception 'access_denied';end if;
 insert into private.shipping_automation_issues(collection_id,store_id,reason) select id,p_store,p_reason from private.shipping_collection_confirmations where case_id=p_case and store_id=p_store and conversation_id=p_conversation on conflict do nothing;
end $$;
create function public.shipping_automation_claim(p_store uuid,p_conversation uuid,p_case uuid,p_settings_version integer,p_parcel_version integer,p_courier text,p_quote integer,p_warehouse_fingerprint text,p_decision uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare c private.shipping_collection_confirmations;s private.shipping_settings;p private.shipping_parcels;d public.eligibility_decisions;case_row public.return_cases;gate jsonb;
begin
 if not private.shipping_collection_binding(p_store,p_conversation,p_case) then raise exception 'access_denied';end if;
 perform pg_advisory_xact_lock(hashtext('shipping_settings'),hashtext(p_store::text));
 perform pg_advisory_xact_lock(hashtext('shipping_parcel'),hashtext(p_store::text));
 perform pg_advisory_xact_lock(hashtext('shipping_collection'),hashtext(p_case::text));
 select * into c from private.shipping_collection_confirmations where case_id=p_case and store_id=p_store and conversation_id=p_conversation;
 if c.id is null then raise exception 'confirmation_required';end if;
 if exists(select 1 from private.shipping_automation where collection_id=c.id) then return false;end if;
 if c.state<>'DETAILS_CONFIRMED' or c.ciphertext is null or c.expires_at<=now() then raise exception 'confirmation_expired';end if;
 select * into s from private.shipping_settings where store_id=p_store;
 select * into case_row from public.return_cases where id=p_case and store_id=p_store;
 select * into p from private.shipping_parcels where store_id=p_store and sku=case_row.item_snapshot->>'sku' and quantity=(case_row.item_snapshot->>'quantity')::integer;
 select * into d from public.eligibility_decisions where id=p_decision and store_id=p_store and order_id=case_row.order_id;
 if s.state is distinct from 'APPROVED' or not s.automatic_requested or s.version is distinct from p_settings_version or c.settings_version is distinct from s.version or s.approved_warehouse_fingerprint is distinct from p_warehouse_fingerprint or not(p_courier=any(s.courier_ids)) or p_quote is null or p_quote not between 1 and s.cap_halalas or p.version is distinct from p_parcel_version or p.store_id is null or case_row.status<>'OPEN' or d.id is null or d.outcome<>'ELIGIBLE' or d.evaluated_at<now()-interval '2 minutes' or d.policy_version_id is distinct from s.policy_version_id or s.policy_version_id is distinct from (select id from public.policy_versions where store_id=p_store order by published_at desc,id desc limit 1) or not exists(select 1 from public.store_billing where store_id=p_store and environment='sandbox' and plan='premium' and status='ACTIVE' and period_start<=now() and period_end>now()) then raise exception 'authorization_changed';end if;
 -- Conservative duplicate rule: another active case for this order/SKU needs merchant review.
 if exists(select 1 from private.shipping_attempts a join public.return_cases other_case on other_case.id=a.case_id and other_case.store_id=a.store_id where a.store_id=p_store and a.environment='sandbox' and a.state not in ('FAILED','CANCELLED') and other_case.order_id=case_row.order_id and other_case.item_snapshot->>'sku'=case_row.item_snapshot->>'sku') then raise exception 'return_quantity_review';end if;
 -- Reserve the full approved cap; release any unused amount only against confirmed actual charges.
 perform public.shipping_reserve_attempt(c.id,p_store,'sandbox',s.warehouse_id,p_case,s.cap_halalas,s.cap_halalas,now()+interval '2 minutes');
 perform public.shipping_claim_submission(c.id,p_store,'sandbox');
 insert into private.shipping_automation(collection_id,store_id,attempt_id,settings_version,parcel_version,courier_id,stage,order_ref,parcel_snapshot)
 values(c.id,p_store,c.id,s.version,p.version,p_courier,'ORDER_CREATING','RLDTEST-'||replace(c.id::text,'-',''),to_jsonb(p));
 return true;
end $$;
create function public.shipping_automation_advance(p_store uuid,p_conversation uuid,p_case uuid,p_from text,p_to text,p_return text default null) returns void
language plpgsql security definer set search_path='' as $$
declare j private.shipping_automation;
begin
 if not private.shipping_collection_binding(p_store,p_conversation,p_case) then raise exception 'access_denied';end if;
 select a.* into j from private.shipping_automation a join private.shipping_collection_confirmations c on c.id=a.collection_id where c.store_id=p_store and c.case_id=p_case and c.conversation_id=p_conversation for update of a;
 if j.collection_id is null then raise exception 'attempt_missing';end if;
 if j.stage<>p_from then raise exception 'stage_changed';end if;
 if not ((p_from='ORDER_CREATING' and p_to='ORDER_READY') or (p_from='ORDER_READY' and p_to='RETURN_CREATING') or (p_from='RETURN_CREATING' and p_to='RETURN_REQUESTED') or (p_to='UNKNOWN' and p_from not in ('VERIFIED','UNKNOWN')) or (p_to='VERIFIED' and p_from in ('RETURN_CREATING','RETURN_REQUESTED','UNKNOWN'))) then raise exception 'invalid_transition';end if;
 if p_return is not null and p_return<>j.order_ref and p_return !~ ('^'||j.order_ref||'-R[0-9]{1,6}$') then raise exception 'return_reference_mismatch';end if;
 update private.shipping_automation set stage=p_to,return_ref=coalesce(p_return,return_ref),updated_at=now() where collection_id=j.collection_id;
end $$;
revoke all on function public.shipping_parcel_save(uuid,uuid,text,integer,integer,integer,integer,integer,integer,boolean),public.shipping_parcel_snapshot(uuid,uuid),public.shipping_automation_read(uuid,uuid,uuid),public.shipping_automation_issue(uuid,uuid,uuid,text),public.shipping_automation_claim(uuid,uuid,uuid,integer,integer,text,integer,text,uuid),public.shipping_automation_advance(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.shipping_parcel_save(uuid,uuid,text,integer,integer,integer,integer,integer,integer,boolean),public.shipping_parcel_snapshot(uuid,uuid),public.shipping_automation_read(uuid,uuid,uuid),public.shipping_automation_issue(uuid,uuid,uuid,text),public.shipping_automation_claim(uuid,uuid,uuid,integer,integer,text,integer,text,uuid),public.shipping_automation_advance(uuid,uuid,uuid,text,text,text) to service_role;

alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_message_type_check;
alter table public.whatsapp_messages add constraint whatsapp_messages_message_type_check check(message_type in ('TEXT','IMAGE','DOCUMENT','INTERACTIVE','FLOW','TEMPLATE','SYSTEM','UNSUPPORTED'));
