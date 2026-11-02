-- Sandbox merchant controls only. No customer journey, worker or live activation.
create table private.shipping_settings(
 store_id uuid primary key references public.stores(id),environment text not null default 'sandbox' check(environment='sandbox'),
 version integer not null default 1 check(version>0),warehouse_id uuid references private.shipping_warehouses(id),
 courier_ids text[] not null default '{}',collection_method text not null default 'PICKUP_BY_DC' check(collection_method in ('PICKUP_BY_DC','BRANCH_DROP_OFF')),
 cap_halalas integer not null check(cap_halalas between 100 and 1000000),automatic_requested boolean not null default false,
 state text not null default 'DRAFT' check(state in ('DRAFT','APPROVED','PAUSED')),approved_warehouse_fingerprint text check(approved_warehouse_fingerprint~'^[0-9a-f]{64}$'),approved_by uuid,approved_at timestamptz,policy_version_id uuid references public.policy_versions(id),updated_at timestamptz not null default now()
);
create table private.shipping_settings_events(
 id bigint generated always as identity primary key,store_id uuid not null references public.stores(id),actor_user_id uuid not null,
 version integer not null,event text not null check(event in ('SAVED','APPROVED','PAUSED')),snapshot jsonb not null,created_at timestamptz not null default now()
);
create table private.shipping_warehouse_requests(
 id uuid primary key,store_id uuid not null references public.stores(id),actor_user_id uuid not null,fingerprint text not null check(fingerprint~'^[0-9a-f]{64}$'),
 state text not null default 'CREATING' check(state in ('CREATING','VERIFIED','UNKNOWN')),warehouse_id uuid references private.shipping_warehouses(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index shipping_warehouse_pending on private.shipping_warehouse_requests(store_id) where state in ('CREATING','UNKNOWN');
alter table private.shipping_settings enable row level security;
alter table private.shipping_settings_events enable row level security;
alter table private.shipping_warehouse_requests enable row level security;
revoke all on private.shipping_settings,private.shipping_settings_events,private.shipping_warehouse_requests from public,anon,authenticated,service_role;
revoke all on sequence private.shipping_settings_events_id_seq from public,anon,authenticated,service_role;
create trigger shipping_settings_events_immutable before update or delete on private.shipping_settings_events for each row execute function private.shipping_immutable();

create function private.shipping_settings_writer(p_store uuid,p_user uuid,p_require_premium boolean default true) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.memberships where store_id=p_store and user_id=p_user and role in ('owner','admin')) then raise exception 'access_denied';end if;
 if p_require_premium and not exists(select 1 from public.store_billing where store_id=p_store and environment='sandbox' and plan='premium' and status='ACTIVE' and period_start<=now() and period_end>now()) then raise exception 'premium_required';end if;
end $$;
revoke all on function private.shipping_settings_writer(uuid,uuid,boolean) from public,anon,authenticated,service_role;

create function public.shipping_settings_snapshot(p_store uuid,p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r text;
begin
 select role into r from public.memberships where store_id=p_store and user_id=p_user;
 if r is null then raise exception 'access_denied';end if;
 return jsonb_build_object('canManage',r in ('owner','admin'),'premium',exists(select 1 from public.store_billing where store_id=p_store and environment='sandbox' and plan='premium' and status='ACTIVE' and period_start<=now() and period_end>now()),
 'settings',(select to_jsonb(s) - 'approved_by' - 'policy_version_id' from private.shipping_settings s where store_id=p_store),
 'warehouses',coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',provider_code)) from private.shipping_warehouses where store_id=p_store and environment='sandbox' and state='ACTIVE'),'[]'::jsonb),
 'pendingWarehouse',(select jsonb_build_object('id',id,'state',state,'createdAt',created_at) from private.shipping_warehouse_requests where store_id=p_store and state in ('CREATING','UNKNOWN') order by created_at desc limit 1),
 'policyChanged',coalesce((select s.automatic_requested and s.state='APPROVED' and s.policy_version_id is distinct from (select id from public.policy_versions where store_id=p_store order by published_at desc,id desc limit 1) from private.shipping_settings s where s.store_id=p_store),false),
 'policyReady',exists(select 1 from public.policy_versions where store_id=p_store),
 'history',coalesce((select jsonb_agg(jsonb_build_object('version',version,'event',event,'createdAt',created_at) order by id desc) from(select * from private.shipping_settings_events where store_id=p_store order by id desc limit 12)e),'[]'::jsonb));
end $$;
create function public.shipping_settings_save(p_store uuid,p_user uuid,p_version integer,p_warehouse uuid,p_couriers text[],p_method text,p_cap integer,p_automatic boolean) returns integer
language plpgsql security definer set search_path='' as $$
declare s private.shipping_settings;new_version integer;
begin
 perform private.shipping_settings_writer(p_store,p_user);
 if p_version is null or p_version<0 or p_cap is null or p_cap not between 100 and 1000000 or p_method is null or p_method not in ('PICKUP_BY_DC','BRANCH_DROP_OFF') or p_automatic is null or p_couriers is null or cardinality(p_couriers) not between 1 and 5 or exists(select 1 from unnest(p_couriers)x where x is null or x not in ('2828','56468','56469','56470','56471')) or cardinality(p_couriers)<>(select count(distinct x) from unnest(p_couriers)x) then raise exception 'invalid_input';end if;
 if not exists(select 1 from private.shipping_warehouses where id=p_warehouse and store_id=p_store and environment='sandbox' and state='ACTIVE') then raise exception 'warehouse_required';end if;
 perform pg_advisory_xact_lock(hashtext('shipping_settings'),hashtext(p_store::text));
 select * into s from private.shipping_settings where store_id=p_store for update;
 if coalesce(s.version,0)<>p_version then raise exception 'settings_changed';end if;
 new_version:=p_version+1;
 insert into private.shipping_settings(store_id,version,warehouse_id,courier_ids,collection_method,cap_halalas,automatic_requested) values(p_store,new_version,p_warehouse,p_couriers,p_method,p_cap,p_automatic)
 on conflict(store_id) do update set version=new_version,warehouse_id=p_warehouse,courier_ids=p_couriers,collection_method=p_method,cap_halalas=p_cap,automatic_requested=p_automatic,state='DRAFT',approved_by=null,approved_at=null,approved_warehouse_fingerprint=null,policy_version_id=null,updated_at=now() returning * into s;
 insert into private.shipping_settings_events(store_id,actor_user_id,version,event,snapshot) values(p_store,p_user,new_version,'SAVED',to_jsonb(s));return new_version;
end $$;
create function public.shipping_settings_approve(p_store uuid,p_user uuid,p_version integer,p_warehouse_fingerprint text) returns integer
language plpgsql security definer set search_path='' as $$
declare s private.shipping_settings;policy_id uuid;
begin
 perform private.shipping_settings_writer(p_store,p_user);
 perform pg_advisory_xact_lock(hashtext('shipping_settings'),hashtext(p_store::text));
 select * into s from private.shipping_settings where store_id=p_store for update;
 if s.store_id is null or p_version is null or s.version<>p_version then raise exception 'settings_changed';end if;
 if p_warehouse_fingerprint is null or p_warehouse_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'warehouse_required';end if;
 if not exists(select 1 from private.shipping_warehouses where id=s.warehouse_id and store_id=p_store and environment='sandbox' and state='ACTIVE') then raise exception 'warehouse_required';end if;
 select id into policy_id from public.policy_versions where store_id=p_store order by published_at desc,id desc limit 1;
 if s.state='APPROVED' and s.policy_version_id is not distinct from policy_id and s.approved_warehouse_fingerprint=p_warehouse_fingerprint then return s.version;end if;
 if s.automatic_requested and policy_id is null then raise exception 'policy_required';end if;
 if exists(select 1 from private.shipping_wallets where store_id=p_store and environment='sandbox' and on_hold) then raise exception 'wallet_on_hold';end if;
 update private.shipping_settings set version=version+1,state='APPROVED',approved_warehouse_fingerprint=p_warehouse_fingerprint,approved_by=p_user,approved_at=now(),policy_version_id=policy_id,updated_at=now() where store_id=p_store returning * into s;
 insert into private.shipping_settings_events(store_id,actor_user_id,version,event,snapshot) values(p_store,p_user,s.version,'APPROVED',to_jsonb(s));return s.version;
end $$;
create function public.shipping_settings_pause(p_store uuid,p_user uuid,p_version integer) returns integer
language plpgsql security definer set search_path='' as $$
declare s private.shipping_settings;
begin
 -- Pausing must remain possible after subscription expiry.
 perform private.shipping_settings_writer(p_store,p_user,false);
 perform pg_advisory_xact_lock(hashtext('shipping_settings'),hashtext(p_store::text));
 select * into s from private.shipping_settings where store_id=p_store for update;
 if s.store_id is null or p_version is null or s.version<>p_version then raise exception 'settings_changed';end if;
 if s.state='PAUSED' then return s.version;end if;
 update private.shipping_settings set version=version+1,state='PAUSED',approved_by=null,approved_at=null,updated_at=now() where store_id=p_store returning * into s;
 insert into private.shipping_settings_events(store_id,actor_user_id,version,event,snapshot) values(p_store,p_user,s.version,'PAUSED',to_jsonb(s));return s.version;
end $$;
create function public.shipping_settings_warehouse_start(p_id uuid,p_store uuid,p_user uuid,p_fingerprint text) returns boolean
language plpgsql security definer set search_path='' as $$
declare r private.shipping_warehouse_requests;
begin
 perform private.shipping_settings_writer(p_store,p_user);
 if p_id is null or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'invalid_input';end if;
 perform pg_advisory_xact_lock(hashtext('shipping_warehouse_request'),hashtext(p_store::text));
 select * into r from private.shipping_warehouse_requests where id=p_id;
 if found then
 if r.store_id<>p_store or r.actor_user_id<>p_user or r.fingerprint<>p_fingerprint then raise exception 'warehouse_request_mismatch';end if;
 return false;
 end if;
 if exists(select 1 from private.shipping_warehouse_requests where store_id=p_store and state in ('CREATING','UNKNOWN')) then raise exception 'warehouse_pending';end if;
 insert into private.shipping_warehouse_requests(id,store_id,actor_user_id,fingerprint) values(p_id,p_store,p_user,p_fingerprint);return true;
end $$;
create function public.shipping_settings_warehouse_finish(p_id uuid,p_store uuid,p_user uuid,p_fingerprint text,p_verified boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare r private.shipping_warehouse_requests;w uuid;
begin
 perform private.shipping_settings_writer(p_store,p_user);
 select * into r from private.shipping_warehouse_requests where id=p_id and store_id=p_store for update;
 if not found or r.actor_user_id<>p_user or r.fingerprint<>p_fingerprint or p_verified is null then raise exception 'warehouse_request_mismatch';end if;
 if r.state='VERIFIED' then return r.warehouse_id;end if;
 if p_verified then
 w:=public.shipping_register_warehouse(p_store,'sandbox','RLDSET'||replace(p_id::text,'-',''));
 update private.shipping_warehouse_requests set state='VERIFIED',warehouse_id=w,updated_at=now() where id=p_id;
 else update private.shipping_warehouse_requests set state='UNKNOWN',updated_at=now() where id=p_id;end if;
 return w;
end $$;
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'shipping_settings_%' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
