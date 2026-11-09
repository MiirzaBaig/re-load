-- Merchant-initiated disconnect must also revoke pending Easy Mode state.
create or replace function public.disconnect_salla_connection(p_store_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_connection_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('salla-easy',0));
  update private.salla_installations set revoked_at=greatest(now(),revoked_at),
    access_ciphertext=null,refresh_ciphertext=null,pending_until=null,updated_at=now()
    where store_id=p_store_id;
  update private.salla_pairing_intents set expires_at=least(expires_at,now()) where store_id=p_store_id;
  select id into v_connection_id from public.commerce_connections where store_id=p_store_id and platform='salla' for update;
  if v_connection_id is not null then
    delete from private.commerce_credentials where connection_id=v_connection_id;
    update public.commerce_connections set status='REVOKED',token_expires_at=null,refresh_started_at=null,updated_at=now()
      where id=v_connection_id;
    insert into public.audit_events(store_id,event_type,entity_type,entity_id,metadata)
      values(p_store_id,'COMMERCE_STORE_DISCONNECTED','commerce_connection',v_connection_id,jsonb_build_object('platform','salla'));
  end if;
end $$;
revoke all on function public.disconnect_salla_connection(uuid) from public,anon,authenticated;
grant execute on function public.disconnect_salla_connection(uuid) to service_role;
