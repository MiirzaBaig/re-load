\set ON_ERROR_STOP on
begin;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema private;
create table public.stores(id uuid primary key);
create table public.memberships(store_id uuid,user_id uuid,role text);
create table public.audit_events(store_id uuid,event_type text,entity_type text,entity_id uuid,metadata jsonb);
create table public.commerce_connections(id uuid primary key default gen_random_uuid(),store_id uuid,platform text,external_store_id text,external_store_name text,status text,scopes text[],token_expires_at timestamptz,refresh_started_at timestamptz,connected_at timestamptz,last_error_code text,updated_at timestamptz,unique(store_id,platform),unique(platform,external_store_id));
create table private.commerce_credentials(connection_id uuid primary key,access_token_ciphertext text,refresh_token_ciphertext text,encryption_key_version integer,updated_at timestamptz);
create function public.disconnect_salla_connection(p_store_id uuid) returns void language plpgsql as $$ begin
 delete from private.commerce_credentials where connection_id in(select id from public.commerce_connections where store_id=p_store_id and platform='salla');
 update public.commerce_connections set status='REVOKED' where store_id=p_store_id and platform='salla';
end $$;
\i supabase/migrations/202609200001_fix_salla_connection_save.sql
\i supabase/migrations/202611090001_salla_easy_mode.sql
\i supabase/migrations/202611090002_salla_disconnect_guard.sql
create function pg_temp.check_it(v boolean,label text) returns void language plpgsql as $$ begin if v is distinct from true then raise exception 'FAILED: %',label; end if; end $$;
insert into public.stores values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.memberships values('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner'),('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','owner');
select pg_temp.check_it(not has_function_privilege('authenticated','public.salla_easy_apply(text,text,text,timestamptz,text,text,text,timestamptz,text[],text)','execute'),'authenticated cannot inject events');
select pg_temp.check_it(not has_table_privilege('anon','private.salla_installations','select'),'anonymous cannot read credentials');
do $$ begin
 begin perform public.salla_easy_start('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',repeat('a',64)); raise exception 'missed role denial'; exception when others then if sqlerrm<>'access_denied' then raise; end if; end;
end $$;
select public.salla_easy_start('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('a',64));
select public.salla_easy_apply(repeat('1',64),'123','app.store.authorize',now()-interval '2 seconds',null,'v1.test.access','v1.test.refresh',now()+interval '14 days',array['orders.read','products.read'],'Test store');
select pg_temp.check_it(not exists(select 1 from public.commerce_connections),'installation alone cannot select workspace');
select public.salla_easy_apply(repeat('2',64),'123','app.settings.updated',now(),repeat('a',64));
select pg_temp.check_it((select status='CONNECTED' from public.commerce_connections where external_store_id='123'),'signed settings pair');
select pg_temp.check_it((select access_ciphertext is null from private.salla_installations where merchant_id='123'),'pending credential copy cleared');
select public.salla_easy_apply(repeat('2',64),'123','app.settings.updated',now(),repeat('a',64));
select pg_temp.check_it((select count(*)=1 from public.audit_events),'replay has no duplicate effect');
select public.salla_easy_start('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',repeat('b',64));
do $$ begin
 begin perform public.salla_easy_apply(repeat('3',64),'123','app.settings.updated',now()+interval '1 second',repeat('b',64)); raise exception 'missed tenant denial'; exception when others then if sqlerrm<>'store_already_linked' then raise; end if; end;
end $$;
select pg_temp.check_it(not public.salla_refresh_complete((select id from public.commerce_connections where external_store_id='123'),'v1.wrong','v1.bad','v1.bad',now()+interval '1 day'), 'stale refresh rejected');
select public.salla_easy_apply(repeat('4',64),'123','app.uninstalled',now()+interval '2 seconds');
select pg_temp.check_it((select status='REVOKED' from public.commerce_connections where external_store_id='123') and not exists(select 1 from private.commerce_credentials),'uninstall erases credentials');
select public.salla_easy_apply(repeat('5',64),'123','app.store.authorize',now()-interval '1 second',null,'v1.stale','v1.stale',now()+interval '14 days',array['orders.read','products.read'],'Test store');
select pg_temp.check_it(not exists(select 1 from private.commerce_credentials),'old authorization cannot revive uninstall');
select pg_temp.check_it(not public.salla_refresh_complete((select id from public.commerce_connections where external_store_id='123'),'v1.test.refresh','v1.bad','v1.bad',now()+interval '1 day'),'refresh cannot revive uninstall');
-- Settings may arrive before authorization, but an expired or used code cannot claim.
select public.salla_easy_apply(repeat('6',64),'456','app.settings.updated',now(),repeat('b',64));
select public.salla_easy_apply(repeat('7',64),'456','app.store.authorize',now()+interval '1 second',null,'v1.new.access','v1.new.refresh',now()+interval '14 days',array['orders.read','products.read'],'Second store');
select pg_temp.check_it((select store_id='22222222-2222-4222-8222-222222222222' from public.commerce_connections where external_store_id='456'),'settings before authorization supported');
select public.salla_easy_apply(repeat('8',64),'789','app.settings.updated',now()+interval '2 seconds',repeat('b',64));
select pg_temp.check_it((select store_id is null from private.salla_installations where merchant_id='789'),'used code cannot claim another merchant');
update private.salla_installations set access_ciphertext='v1.pending',refresh_ciphertext='v1.pending',pending_until=now()-interval '1 minute' where merchant_id='789';
select public.salla_easy_purge();
select pg_temp.check_it((select access_ciphertext is null and refresh_ciphertext is null from private.salla_installations where merchant_id='789'),'pending token retention');
-- Expiry and membership are rechecked after the code was entered.
insert into public.stores values('33333333-3333-4333-8333-333333333333');
insert into public.memberships values('33333333-3333-4333-8333-333333333333','cccccccc-cccc-4ccc-8ccc-cccccccccccc','owner');
select public.salla_easy_start('33333333-3333-4333-8333-333333333333','cccccccc-cccc-4ccc-8ccc-cccccccccccc',repeat('c',64));
select public.salla_easy_apply(repeat('9',64),'999','app.settings.updated',now(),repeat('c',64));
delete from public.memberships where store_id='33333333-3333-4333-8333-333333333333';
select public.salla_easy_apply(repeat('a',64),'999','app.store.authorize',now()+interval '1 second',null,'v1.new','v1.new',now()+interval '14 days',array['orders.read','products.read'],'Pending');
select pg_temp.check_it(not exists(select 1 from public.commerce_connections where external_store_id='999'),'lost membership cannot complete pairing');
insert into public.memberships values('33333333-3333-4333-8333-333333333333','cccccccc-cccc-4ccc-8ccc-cccccccccccc','owner');
update private.salla_pairing_intents set expires_at=now()-interval '1 minute' where code_hash=repeat('c',64);
select public.salla_easy_apply(repeat('b',64),'999','app.store.authorize',now()+interval '2 seconds',null,'v1.newer','v1.newer',now()+interval '14 days',array['orders.read','products.read'],'Pending');
select pg_temp.check_it(not exists(select 1 from public.commerce_connections where external_store_id='999'),'expired pending pairing cannot connect');
-- A stuck refresh claim is never reclaimed with the same single-use token.
select pg_temp.check_it(public.claim_salla_refresh((select id from public.commerce_connections where external_store_id='456')),'first refresh claimed');
update public.commerce_connections set refresh_started_at=now()-interval '1 hour' where external_store_id='456';
select pg_temp.check_it(not public.claim_salla_refresh((select id from public.commerce_connections where external_store_id='456')),'uncertain refresh cannot replay');
select public.disconnect_salla_connection('22222222-2222-4222-8222-222222222222');
select public.salla_easy_apply(repeat('c',64),'456','app.store.authorize',now()-interval '1 second',null,'v1.old','v1.old',now()+interval '14 days',array['orders.read','products.read'],'Second store');
select pg_temp.check_it((select status='REVOKED' from public.commerce_connections where external_store_id='456') and not exists(select 1 from private.commerce_credentials),'manual disconnect cannot be reversed by delayed authorization');
rollback;
