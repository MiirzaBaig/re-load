-- Isolated, temporary OAuth proof for an explicitly allowed development store.
-- Never replaces public.commerce_connections or private.commerce_credentials.
create table private.zid_dev_oauth_attempts (
 state_hash text primary key check(state_hash ~ '^[a-f0-9]{64}$'),
 browser_hash text not null unique check(browser_hash ~ '^[a-f0-9]{64}$'),
 state text not null default 'PENDING' check(state in ('PENDING','EXCHANGING','COMPLETE','FAILED')),
 external_store_id text,
 store_name text,
 payment_link_available boolean,
 token_ciphertext text,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '10 minutes',
 check(token_ciphertext is null or (state='COMPLETE' and external_store_id is not null))
);
revoke all on private.zid_dev_oauth_attempts from public,anon,authenticated;

create function public.create_zid_dev_oauth_attempt(p_state_hash text,p_browser_hash text)
returns void language plpgsql security definer set search_path='' as $$
begin
 -- Bounded development-only entry. No arbitrary callback or tenant ID accepted.
 perform pg_advisory_xact_lock(20261021,1);
 delete from private.zid_dev_oauth_attempts where expires_at<=now();
 if (select count(*) from private.zid_dev_oauth_attempts where created_at>now()-interval '10 minutes')>=40 then
  raise exception 'zid_dev_attempt_limit';
 end if;
 insert into private.zid_dev_oauth_attempts(state_hash,browser_hash) values(p_state_hash,p_browser_hash);
end;$$;

create function public.claim_zid_dev_oauth_attempt(p_state_hash text,p_browser_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 update private.zid_dev_oauth_attempts set state='EXCHANGING'
 where state_hash=p_state_hash and browser_hash=p_browser_hash and state='PENDING' and expires_at>now();
 get diagnostics changed=row_count;
 return changed=1;
end;$$;

create function public.finish_zid_dev_oauth_attempt(p_state_hash text,p_browser_hash text,p_external_store_id text,p_store_name text,p_payment_link_available boolean,p_token_ciphertext text)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 if p_external_store_id !~ '^[0-9]{1,20}$' or p_external_store_id is null or p_store_name is null or length(p_store_name)>120 or p_token_ciphertext is null or p_token_ciphertext not like 'zid-dev-v1.%' or length(p_token_ciphertext)>100000 then
  raise exception 'zid_dev_result_invalid';
 end if;
 update private.zid_dev_oauth_attempts set state='COMPLETE',external_store_id=p_external_store_id,store_name=p_store_name,payment_link_available=p_payment_link_available,token_ciphertext=p_token_ciphertext,expires_at=now()+interval '30 minutes'
 where state_hash=p_state_hash and browser_hash=p_browser_hash and state='EXCHANGING' and expires_at>now();
 get diagnostics changed=row_count;
 return changed=1;
end;$$;

create function public.fail_zid_dev_oauth_attempt(p_state_hash text,p_browser_hash text)
returns void language sql security definer set search_path='' as $$
 update private.zid_dev_oauth_attempts set state='FAILED',token_ciphertext=null
 where state_hash=p_state_hash and browser_hash=p_browser_hash and state='EXCHANGING';
$$;

create function public.get_zid_dev_oauth_result(p_browser_hash text)
returns table(store_name text,payment_link_available boolean)
language sql security definer set search_path='' as $$
 select t.store_name,t.payment_link_available from private.zid_dev_oauth_attempts t
 where t.browser_hash=p_browser_hash and t.state='COMPLETE' and t.expires_at>now();
$$;

revoke all on function public.create_zid_dev_oauth_attempt(text,text) from public,anon,authenticated;
revoke all on function public.claim_zid_dev_oauth_attempt(text,text) from public,anon,authenticated;
revoke all on function public.finish_zid_dev_oauth_attempt(text,text,text,text,boolean,text) from public,anon,authenticated;
revoke all on function public.fail_zid_dev_oauth_attempt(text,text) from public,anon,authenticated;
revoke all on function public.get_zid_dev_oauth_result(text) from public,anon,authenticated;
grant execute on function public.create_zid_dev_oauth_attempt(text,text) to service_role;
grant execute on function public.claim_zid_dev_oauth_attempt(text,text) to service_role;
grant execute on function public.finish_zid_dev_oauth_attempt(text,text,text,text,boolean,text) to service_role;
grant execute on function public.fail_zid_dev_oauth_attempt(text,text) to service_role;
grant execute on function public.get_zid_dev_oauth_result(text) to service_role;
