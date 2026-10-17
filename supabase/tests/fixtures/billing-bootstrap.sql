create schema auth;
create schema private;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('test.auth_role',true),''),'anon')$$;
create function private.platform_mfa_verified() returns boolean language sql stable as $$select true$$;
create table public.stores(id uuid primary key);
create table public.memberships(store_id uuid,user_id uuid,role text);
create table public.platform_admins(user_id uuid,role text);
create table public.platform_admin_events(actor_user_id uuid,event_type text,entity_type text,entity_id uuid);

create table private.journey_activity(store_id uuid,conversation_id uuid,kind text,step text,source_message_id text);
create table public.whatsapp_conversations(id uuid,store_id uuid);
