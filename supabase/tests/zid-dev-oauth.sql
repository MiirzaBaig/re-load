-- Isolated local-only contract tests; never use the production database.
do $$ begin
 if has_table_privilege('anon','private.zid_dev_oauth_attempts','SELECT') or has_table_privilege('authenticated','private.zid_dev_oauth_attempts','SELECT') then raise exception 'private token table exposed'; end if;
 if has_function_privilege('anon','public.get_zid_dev_oauth_result(text)','EXECUTE') or has_function_privilege('authenticated','public.create_zid_dev_oauth_attempt(text,text)','EXECUTE') then raise exception 'anonymous RPC access exposed'; end if;
end $$;
select public.create_zid_dev_oauth_attempt(repeat('a',64),repeat('b',64));
do $$ begin
 if public.claim_zid_dev_oauth_attempt(repeat('a',64),repeat('c',64)) then raise exception 'wrong browser claimed attempt'; end if;
 if not public.claim_zid_dev_oauth_attempt(repeat('a',64),repeat('b',64)) then raise exception 'valid attempt not claimed'; end if;
 if public.claim_zid_dev_oauth_attempt(repeat('a',64),repeat('b',64)) then raise exception 'replayed attempt claimed twice'; end if;
 if public.finish_zid_dev_oauth_attempt(repeat('a',64),repeat('c',64),'3258532','testing-z',true,'zid-dev-v1.test') then raise exception 'wrong browser finalized'; end if;
 if not public.finish_zid_dev_oauth_attempt(repeat('a',64),repeat('b',64),'3258532','testing-z',null,'zid-dev-v1.test') then raise exception 'valid attempt not saved'; end if;
 if public.finish_zid_dev_oauth_attempt(repeat('a',64),repeat('b',64),'3258532','testing-z',true,'zid-dev-v1.replaced') then raise exception 'completed record replaced'; end if;
 if exists(select from public.get_zid_dev_oauth_result(repeat('c',64))) then raise exception 'cross-browser result leaked'; end if;
 if not exists(select from public.get_zid_dev_oauth_result(repeat('b',64)) where store_name='testing-z' and payment_link_available is null) then raise exception 'result lost or unknown capability changed'; end if;
end $$;
update private.zid_dev_oauth_attempts set expires_at=now()-interval '1 second';
do $$ begin
 if exists(select from public.get_zid_dev_oauth_result(repeat('b',64))) then raise exception 'expired result leaked'; end if;
end $$;
select public.create_zid_dev_oauth_attempt(repeat('d',64),repeat('e',64));
do $$ begin
 if exists(select from private.zid_dev_oauth_attempts where state_hash=repeat('a',64)) then raise exception 'expired tokens not purged'; end if;
end $$;
update private.zid_dev_oauth_attempts set expires_at=now()-interval '1 second';
do $$ begin
 if public.claim_zid_dev_oauth_attempt(repeat('d',64),repeat('e',64)) then raise exception 'expired attempt claimed'; end if;
end $$;
select public.create_zid_dev_oauth_attempt(repeat('f',64),repeat('a',64));
select public.claim_zid_dev_oauth_attempt(repeat('f',64),repeat('a',64));
select public.fail_zid_dev_oauth_attempt(repeat('f',64),repeat('a',64));
do $$ begin
 if public.finish_zid_dev_oauth_attempt(repeat('f',64),repeat('a',64),'3258532','testing-z',true,'zid-dev-v1.test') then raise exception 'failed exchange resumed'; end if;
end $$;
do $$ begin
 for i in 1..39 loop perform public.create_zid_dev_oauth_attempt(md5(i::text)||md5(i::text),md5((i+100)::text)||md5((i+100)::text)); end loop;
 begin
  perform public.create_zid_dev_oauth_attempt(repeat('a',64),repeat('b',64));
  raise exception 'rate limit failed';
 exception when others then
  if sqlerrm<>'zid_dev_attempt_limit' then raise; end if;
 end;
end $$;
