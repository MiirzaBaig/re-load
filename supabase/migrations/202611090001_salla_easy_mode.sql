-- Easy Mode never guesses a workspace from an email, name or first install.
-- Credentials wait privately for a merchant-controlled, one-time settings code.
create table private.salla_installations (
  merchant_id text primary key,
  store_id uuid references public.stores(id) on delete set null,
  authorized_at timestamptz,
  revoked_at timestamptz,
  settings_at timestamptz,
  access_ciphertext text,
  refresh_ciphertext text,
  token_expires_at timestamptz,
  pending_until timestamptz,
  scopes text[] not null default '{}',
  store_name text,
  updated_at timestamptz not null default now()
);
create table private.salla_pairing_intents (
  code_hash text primary key check(code_hash ~ '^[a-f0-9]{64}$'),
  store_id uuid not null references public.stores(id) on delete cascade,
  actor_id uuid not null,
  merchant_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  used_at timestamptz
);
create index salla_pairing_store_idx on private.salla_pairing_intents(store_id,created_at);
create table private.salla_easy_receipts (
  digest text primary key,
  created_at timestamptz not null default now()
);
revoke all on private.salla_installations,private.salla_pairing_intents,private.salla_easy_receipts from public,anon,authenticated;
alter table private.salla_installations enable row level security;
alter table private.salla_pairing_intents enable row level security;
alter table private.salla_easy_receipts enable row level security;

-- Never retry an uncertain single-use refresh after a time-based lease.
-- A fresh signed authorization is the recovery path for a stuck claim.
create or replace function public.claim_salla_refresh(p_connection_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.commerce_connections set refresh_started_at=now(),updated_at=now()
    where id=p_connection_id and platform='salla' and status='CONNECTED' and refresh_started_at is null;
  return found;
end $$;
revoke all on function public.claim_salla_refresh(uuid) from public,anon,authenticated;
grant execute on function public.claim_salla_refresh(uuid) to service_role;

create function public.salla_easy_start(p_store uuid,p_actor uuid,p_hash text)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('salla-easy',0));
  if not exists(select 1 from public.memberships where store_id=p_store and user_id=p_actor and role in ('owner','admin')) then
    raise exception 'access_denied';
  end if;
  if exists(select 1 from public.commerce_connections where store_id=p_store and status='CONNECTED' and platform<>'salla') then
    raise exception 'other_platform_connected';
  end if;
  if exists(select 1 from public.commerce_connections where store_id=p_store and status='CONNECTED' and platform='salla') then
    raise exception 'already_connected';
  end if;
  if (select count(*) from private.salla_pairing_intents where store_id=p_store and created_at>now()-interval '1 hour')>=5 then
    raise exception 'rate_limited';
  end if;
  update private.salla_pairing_intents set expires_at=now() where store_id=p_store and used_at is null;
  insert into private.salla_pairing_intents(code_hash,store_id,actor_id) values(p_hash,p_store,p_actor);
end $$;

create function public.salla_easy_apply(
  p_digest text,p_merchant text,p_event text,p_occurred timestamptz,
  p_code_hash text default null,p_access text default null,p_refresh text default null,
  p_expires timestamptz default null,p_scopes text[] default '{}',p_name text default null
) returns void language plpgsql security definer set search_path='' as $$
declare
  v_install private.salla_installations%rowtype;
  v_intent private.salla_pairing_intents%rowtype;
  v_store uuid;
  v_connection uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('salla-easy',0));
  if p_digest !~ '^[a-f0-9]{64}$' or p_merchant !~ '^[1-9][0-9]{0,19}$' or p_occurred is null
    or p_occurred>now()+interval '5 minutes' then raise exception 'invalid_event'; end if;
  insert into private.salla_easy_receipts(digest) values(p_digest) on conflict do nothing;
  if not found then return; end if;
  insert into private.salla_installations(merchant_id,store_id)
    select p_merchant,c.store_id from public.commerce_connections c where c.platform='salla' and c.external_store_id=p_merchant
    on conflict do nothing;
  insert into private.salla_installations(merchant_id) values(p_merchant) on conflict do nothing;
  select * into v_install from private.salla_installations where merchant_id=p_merchant for update;

  if p_event in ('app.uninstalled','app.store.uninstalled') then
    if p_occurred < greatest(v_install.authorized_at, v_install.revoked_at) then return; end if;
    if v_install.store_id is not null then perform public.disconnect_salla_connection(v_install.store_id); end if;
    update private.salla_installations set revoked_at=p_occurred,access_ciphertext=null,refresh_ciphertext=null,
      pending_until=null,updated_at=now() where merchant_id=p_merchant;
    return;
  elsif p_event='app.store.authorize' then
    if p_occurred<=greatest(v_install.authorized_at,v_install.revoked_at) then return; end if;
    if p_access is null or p_access not like 'v1.%' or p_refresh is null or p_refresh not like 'v1.%'
      or p_expires<=now() or p_expires is null
      or not (p_scopes && array['orders.read','orders.read_write'])
      or not (p_scopes && array['products.read','products.read_write']) then raise exception 'invalid_event'; end if;
    update private.salla_installations set authorized_at=p_occurred,access_ciphertext=p_access,
      refresh_ciphertext=p_refresh,token_expires_at=p_expires,pending_until=now()+interval '24 hours',
      scopes=p_scopes,store_name=left(p_name,120),updated_at=now() where merchant_id=p_merchant;
  elsif p_event='app.settings.updated' then
    if p_code_hash is null or p_occurred<=v_install.revoked_at or p_occurred<=v_install.settings_at then return; end if;
    select * into v_intent from private.salla_pairing_intents where code_hash=p_code_hash for update;
    if not found or v_intent.used_at is not null or v_intent.expires_at<=now()
      or p_occurred<v_intent.created_at-interval '5 seconds'
      or not exists(select 1 from public.memberships where store_id=v_intent.store_id and user_id=v_intent.actor_id and role in ('owner','admin')) then return; end if;
    if v_install.store_id is not null and v_install.store_id<>v_intent.store_id then raise exception 'store_already_linked'; end if;
    if exists(select 1 from public.commerce_connections where store_id=v_intent.store_id
      and ((platform='salla' and external_store_id<>p_merchant) or (platform<>'salla' and status='CONNECTED'))) then
      raise exception 'workspace_already_linked';
    end if;
    if exists(select 1 from private.salla_pairing_intents where store_id=v_intent.store_id and used_at is not null
      and merchant_id<>p_merchant) then raise exception 'workspace_already_linked'; end if;
    update private.salla_pairing_intents set used_at=now(),merchant_id=p_merchant where code_hash=p_code_hash;
    update private.salla_installations set store_id=v_intent.store_id,settings_at=p_occurred,updated_at=now() where merchant_id=p_merchant;
  else raise exception 'invalid_event'; end if;

  select * into v_install from private.salla_installations where merchant_id=p_merchant;
  v_store:=v_install.store_id;
  if v_store is null or v_install.access_ciphertext is null or v_install.pending_until<=now()
    or v_install.token_expires_at<=now() or v_install.authorized_at<=v_install.revoked_at then return; end if;
  -- For the first connection, the approving Reload member and code must
  -- still be valid even when authorization arrives after settings.
  if not exists(select 1 from public.commerce_connections where platform='salla' and external_store_id=p_merchant and store_id=v_store)
    and not exists(select 1 from private.salla_pairing_intents i join public.memberships m
      on m.store_id=i.store_id and m.user_id=i.actor_id and m.role in ('owner','admin')
      where i.store_id=v_store and i.merchant_id=p_merchant and i.used_at is not null and i.expires_at>now()) then return; end if;
  if exists(select 1 from public.commerce_connections where store_id=v_store and platform<>'salla' and status='CONNECTED') then
    raise exception 'workspace_already_linked';
  end if;
  v_connection:=public.finalize_salla_connection(v_store,p_merchant,v_install.store_name,v_install.scopes,
    v_install.token_expires_at,v_install.access_ciphertext,v_install.refresh_ciphertext);
  update public.commerce_connections set refresh_started_at=null where id=v_connection;
  -- Private pending copies are no longer needed after credentials move to the connection.
  update private.salla_installations set access_ciphertext=null,refresh_ciphertext=null,pending_until=null where merchant_id=p_merchant;
end $$;

-- A refresh response may race an uninstall or a newer authorization event.
-- Commit only if the exact credential that started it is still current.
create function public.salla_refresh_complete(p_connection uuid,p_expected_refresh text,p_access text,p_refresh text,p_expires timestamptz,p_failed boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('salla-easy',0));
  perform 1 from public.commerce_connections c join private.commerce_credentials cr on cr.connection_id=c.id
    where c.id=p_connection and c.platform='salla' and c.status='CONNECTED'
      and cr.refresh_token_ciphertext=p_expected_refresh for update of c,cr;
  if not found then return false; end if;
  if p_failed then
    update public.commerce_connections set status='EXPIRED',refresh_started_at=null,last_error_code='SALLA_REAUTHORIZE',updated_at=now() where id=p_connection;
  else
    if p_access is null or p_access not like 'v1.%' or p_refresh is null or p_refresh not like 'v1.%'
      or p_expires is null or p_expires<=now() then raise exception 'invalid_refresh'; end if;
    update private.commerce_credentials set access_token_ciphertext=p_access,refresh_token_ciphertext=p_refresh,updated_at=now() where connection_id=p_connection;
    update public.commerce_connections set token_expires_at=p_expires,refresh_started_at=null,last_error_code=null,updated_at=now() where id=p_connection;
  end if;
  return true;
end $$;

create function public.salla_easy_purge() returns void language plpgsql security definer set search_path='' as $$
begin
  update private.salla_installations set access_ciphertext=null,refresh_ciphertext=null,pending_until=null
    where pending_until<now();
  delete from private.salla_pairing_intents where expires_at<now()-interval '1 day';
  delete from private.salla_easy_receipts where created_at<now()-interval '30 days';
end $$;
revoke all on function public.salla_easy_start(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.salla_easy_apply(text,text,text,timestamptz,text,text,text,timestamptz,text[],text) from public,anon,authenticated;
revoke all on function public.salla_easy_purge() from public,anon,authenticated;
revoke all on function public.salla_refresh_complete(uuid,text,text,text,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.salla_easy_start(uuid,uuid,text) to service_role;
grant execute on function public.salla_easy_apply(text,text,text,timestamptz,text,text,text,timestamptz,text[],text) to service_role;
grant execute on function public.salla_easy_purge() to service_role;
grant execute on function public.salla_refresh_complete(uuid,text,text,text,timestamptz,boolean) to service_role;
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
   perform cron.schedule('salla-easy-private-cleanup','*/15 * * * *','select public.salla_easy_purge();');
 end if;
end $$;
