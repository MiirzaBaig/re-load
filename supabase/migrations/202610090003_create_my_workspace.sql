-- Signed-in users without a store (older accounts made before sign-up
-- created one automatically) can create their workspace themselves.
-- Safe to call twice: if the caller already belongs to a store, that store
-- is returned and nothing new is created.

create function public.create_my_store_workspace(p_store_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_store uuid;
  v_name text := coalesce(nullif(trim(p_store_name), ''), 'My Store');
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if char_length(v_name) > 120 then raise exception 'Store name is too long.' using errcode = '22001'; end if;

  select store_id into v_store from public.memberships where user_id = v_user order by created_at limit 1;
  if v_store is not null then return v_store; end if;

  insert into public.stores (name) values (v_name) returning id into v_store;
  insert into public.memberships (store_id, user_id, role) values (v_store, v_user, 'owner');
  insert into public.audit_events (store_id, event_type, entity_type, entity_id, metadata)
  values (v_store, 'STORE_WORKSPACE_CREATED', 'store', v_store, jsonb_build_object('source', 'self_serve'));
  return v_store;
end;
$$;

revoke all on function public.create_my_store_workspace(text) from public, anon;
grant execute on function public.create_my_store_workspace(text) to authenticated;
