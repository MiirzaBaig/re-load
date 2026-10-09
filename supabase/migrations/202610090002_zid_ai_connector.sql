-- Zid stores connect through Zid's official AI Connector (MCP): the merchant
-- installs it and pastes their private MCP link into Reload. The link grants
-- full store access, so it is stored like any other credential: encrypted,
-- in private.commerce_credentials, reachable only by Edge Functions.

alter table public.commerce_connections drop constraint commerce_connections_platform_check;
alter table public.commerce_connections add constraint commerce_connections_platform_check
  check (platform in ('salla', 'zid'));

-- How the store is connected: Salla through our OAuth app, Zid through MCP.
alter table public.commerce_connections
  add column connection_method text not null default 'oauth'
  check (connection_method in ('oauth', 'mcp'));

alter table public.integration_events drop constraint integration_events_provider_check;
alter table public.integration_events add constraint integration_events_provider_check
  check (provider in ('salla', 'whatsapp', 'zid'));

-- Save (or replace) a store's Zid connection and its encrypted MCP link.
create function public.save_zid_connection(
  p_store_id uuid,
  p_external_store_id text,
  p_external_store_name text,
  p_link_ciphertext text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_connection_id uuid;
begin
  insert into public.commerce_connections (
    store_id, platform, external_store_id, external_store_name, status,
    connection_method, connected_at, last_synced_at, last_error_code, updated_at
  ) values (
    p_store_id, 'zid', p_external_store_id, p_external_store_name, 'CONNECTED',
    'mcp', now(), now(), null, now()
  )
  on conflict (store_id, platform) do update set
    external_store_id = excluded.external_store_id,
    external_store_name = excluded.external_store_name,
    status = 'CONNECTED', connection_method = 'mcp',
    connected_at = now(), last_synced_at = now(), last_error_code = null, updated_at = now()
  returning id into v_connection_id;

  insert into private.commerce_credentials (connection_id, access_token_ciphertext, refresh_token_ciphertext, updated_at)
  values (v_connection_id, p_link_ciphertext, null, now())
  on conflict (connection_id) do update set
    access_token_ciphertext = excluded.access_token_ciphertext, refresh_token_ciphertext = null, updated_at = now();

  insert into public.audit_events (store_id, event_type, entity_type, entity_id, metadata)
  values (p_store_id, 'COMMERCE_STORE_CONNECTED', 'commerce_connection', v_connection_id,
    jsonb_build_object('platform', 'zid', 'method', 'mcp'));
  return v_connection_id;
end;
$$;

create function public.get_zid_credential(p_store_id uuid)
returns table (connection_id uuid, link_ciphertext text)
language sql security definer set search_path = '' as $$
  select c.id, credentials.access_token_ciphertext
  from public.commerce_connections c
  join private.commerce_credentials credentials on credentials.connection_id = c.id
  where c.store_id = p_store_id and c.platform = 'zid' and c.status = 'CONNECTED'
  limit 1;
$$;

create function public.disconnect_zid_connection(p_store_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_connection_id uuid;
begin
  select id into v_connection_id from public.commerce_connections
  where store_id = p_store_id and platform = 'zid';
  if v_connection_id is not null then
    delete from private.commerce_credentials where commerce_credentials.connection_id = v_connection_id;
    update public.commerce_connections set status = 'REVOKED', updated_at = now() where id = v_connection_id;
    insert into public.audit_events (store_id, event_type, entity_type, entity_id, metadata)
    values (p_store_id, 'COMMERCE_STORE_DISCONNECTED', 'commerce_connection', v_connection_id,
      jsonb_build_object('platform', 'zid'));
  end if;
end;
$$;

revoke all on function public.save_zid_connection(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.get_zid_credential(uuid) from public, anon, authenticated;
revoke all on function public.disconnect_zid_connection(uuid) from public, anon, authenticated;
grant execute on function public.save_zid_connection(uuid, text, text, text) to service_role;
grant execute on function public.get_zid_credential(uuid) to service_role;
grant execute on function public.disconnect_zid_connection(uuid) to service_role;
