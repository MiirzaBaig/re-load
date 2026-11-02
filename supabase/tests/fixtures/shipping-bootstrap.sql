create schema auth;
create schema private;
revoke all on schema private from public;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create function auth.role() returns text language sql as $$ select coalesce(nullif(current_setting('test.auth_role',true),''),'authenticated') $$;
create table public.stores(id uuid primary key);
create table public.memberships(store_id uuid references public.stores(id),user_id uuid,role text);
create table public.return_cases(id uuid primary key,store_id uuid references public.stores(id),status text);
create table public.platform_admin_events(actor_user_id uuid,event_type text,entity_type text,entity_id uuid,created_at timestamptz default now());
create function private.is_store_member(p_store uuid) returns boolean language sql as $$ select exists(select 1 from public.memberships where store_id=p_store and user_id=auth.uid()) $$;
create function private.is_platform_owner() returns boolean language sql as $$ select current_setting('test.staff_role',true)='owner' $$;
create function private.platform_mfa_verified() returns boolean language sql as $$ select coalesce(current_setting('test.mfa',true),'yes')<>'no' $$;

create table public.store_billing(store_id uuid,environment text,plan text,status text,period_start timestamptz,period_end timestamptz);

create table public.policy_versions(id uuid primary key default gen_random_uuid(),store_id uuid references public.stores(id),published_at timestamptz default now());
