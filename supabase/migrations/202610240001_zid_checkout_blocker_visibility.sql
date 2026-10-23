-- Expose only whether the isolated development proof has an unresolved creation.
-- Do not clear, retry or change any checkout record.
create or replace function public.get_zid_dev_checkout_session(p_browser_hash text)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object(
  'session_hash',s.state_hash,'external_store_id',s.external_store_id,
  'store_name',s.store_name,'token_ciphertext',s.token_ciphertext,
  'creation_blocked',exists(select 1 from private.zid_dev_checkouts b where b.state in ('CREATING','UNKNOWN')),
  'checkout',case when c.session_hash is null then null else to_jsonb(c) end)
 from private.zid_dev_oauth_attempts s
 left join private.zid_dev_checkouts c on c.session_hash=s.state_hash
 where s.browser_hash=p_browser_hash and s.state='COMPLETE' and s.expires_at>now();
$$;
revoke all on function public.get_zid_dev_checkout_session(text) from public,anon,authenticated;
grant execute on function public.get_zid_dev_checkout_session(text) to service_role;
