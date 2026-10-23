-- Isolated development checkout proof. No merchant billing/connection changes.
create table private.zid_dev_checkouts (
 session_hash text primary key,
 external_store_id text not null default '3258532' check(external_store_id='3258532'),
 state text not null check(state in ('READY','CREATING','CREATED','FAILED','UNKNOWN')),
 request_ciphertext text, summary jsonb not null,
 order_id text, result_ciphertext text,
 revision uuid not null default gen_random_uuid(),
 expires_at timestamptz not null default now()+interval '10 minutes',
 updated_at timestamptz not null default now(),
 check(jsonb_typeof(summary)='object'), check(length(request_ciphertext)<40000),
 check(state<>'CREATED' or (order_id is not null and order_id ~ '^[0-9]{1,20}$'))
);
revoke all on private.zid_dev_checkouts from public,anon,authenticated;
create function public.get_zid_dev_checkout_session(p_browser_hash text)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('session_hash',s.state_hash,'external_store_id',s.external_store_id,'store_name',s.store_name,'token_ciphertext',s.token_ciphertext,
  'checkout',case when c.session_hash is null then null else to_jsonb(c) end)
 from private.zid_dev_oauth_attempts s left join private.zid_dev_checkouts c on c.session_hash=s.state_hash
 where s.browser_hash=p_browser_hash and s.state='COMPLETE' and s.expires_at>now();
$$;
create function public.prepare_zid_dev_checkout(p_browser_hash text,p_request_ciphertext text,p_summary jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare session_id text;
begin
 delete from private.zid_dev_checkouts where updated_at<now()-interval '7 days' and state in ('READY','FAILED','CREATED');
 update private.zid_dev_checkouts set request_ciphertext=null,result_ciphertext=null,summary='{}' where updated_at<now()-interval '7 days' and state in ('CREATING','UNKNOWN');
 select state_hash into session_id from private.zid_dev_oauth_attempts where browser_hash=p_browser_hash and state='COMPLETE' and expires_at>now() for update;
 if session_id is null then return false; end if;
 if p_request_ciphertext is null or p_request_ciphertext not like 'zid-checkout-v1.%' or length(p_request_ciphertext)>40000 or jsonb_typeof(p_summary)<>'object' or length(p_summary::text)>6000 then raise exception 'invalid_checkout'; end if;
 insert into private.zid_dev_checkouts(session_hash,state,request_ciphertext,summary) values(session_id,'READY',p_request_ciphertext,p_summary)
 on conflict(session_hash) do update set state='READY',request_ciphertext=excluded.request_ciphertext,summary=excluded.summary,revision=gen_random_uuid(),expires_at=now()+interval '10 minutes',updated_at=now()
 where private.zid_dev_checkouts.state in ('READY','FAILED');
 return found;
end $$;
create function public.claim_zid_dev_checkout(p_browser_hash text,p_revision uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 -- Uncertain writes block fresh authorizations too; reconnecting must not bypass recovery.
 perform pg_advisory_xact_lock(20261022,1);
 if exists(select 1 from private.zid_dev_checkouts where state in ('CREATING','UNKNOWN')) then return false; end if;
 update private.zid_dev_checkouts c set state='CREATING',updated_at=now()
 from private.zid_dev_oauth_attempts s where s.state_hash=c.session_hash and s.browser_hash=p_browser_hash and s.state='COMPLETE' and s.expires_at>now()
 and c.revision=p_revision and c.state='READY' and c.expires_at>now();
 return found;
end $$;
create function public.finish_zid_dev_checkout(p_browser_hash text,p_state text,p_order_id text default null,p_result_ciphertext text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_state not in ('CREATED','FAILED','UNKNOWN') or (p_order_id is not null and p_order_id !~ '^[0-9]{1,20}$') or (p_state='CREATED' and (p_order_id is null or p_result_ciphertext is null)) or length(p_result_ciphertext)>40000 then raise exception 'invalid_checkout_result'; end if;
 update private.zid_dev_checkouts c set state=p_state,order_id=p_order_id,result_ciphertext=p_result_ciphertext,updated_at=now()
 from private.zid_dev_oauth_attempts s where s.state_hash=c.session_hash and s.browser_hash=p_browser_hash and c.state='CREATING';
 return found;
end $$;
revoke all on function public.get_zid_dev_checkout_session(text),public.prepare_zid_dev_checkout(text,text,jsonb),public.claim_zid_dev_checkout(text,uuid),public.finish_zid_dev_checkout(text,text,text,text) from public,anon,authenticated;
grant execute on function public.get_zid_dev_checkout_session(text),public.prepare_zid_dev_checkout(text,text,jsonb),public.claim_zid_dev_checkout(text,uuid),public.finish_zid_dev_checkout(text,text,text,text) to service_role;
