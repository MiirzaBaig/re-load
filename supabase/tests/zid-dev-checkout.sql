do $$
declare browser text:=repeat('c',64); state_id text:=repeat('d',64); revision_id uuid;
begin
 -- The preceding limiter contract fills this isolated test database with 40 attempts.
 delete from private.zid_dev_oauth_attempts;
 if has_function_privilege('anon','public.get_zid_dev_checkout_session(text)','EXECUTE') or has_table_privilege('authenticated','private.zid_dev_checkouts','SELECT') then raise exception 'public_access'; end if;
 perform public.create_zid_dev_oauth_attempt(state_id,browser);
 perform public.claim_zid_dev_oauth_attempt(state_id,browser);
 perform public.finish_zid_dev_oauth_attempt(state_id,browser,'3258532','testing-z',true,'zid-dev-v1.fake-test');
 if public.get_zid_dev_checkout_session(repeat('e',64)) is not null then raise exception 'wrong_browser'; end if;
 if not public.prepare_zid_dev_checkout(browser,'zid-checkout-v1.fake','{"product":"test"}') then raise exception 'prepare_failed'; end if;
 select revision into revision_id from private.zid_dev_checkouts where session_hash=state_id;
 if public.claim_zid_dev_checkout(repeat('e',64),revision_id) then raise exception 'wrong_browser_claim'; end if;
 if public.claim_zid_dev_checkout(browser,gen_random_uuid()) then raise exception 'stale_review_claim'; end if;
 if not public.claim_zid_dev_checkout(browser,revision_id) then raise exception 'claim_failed'; end if;
 if public.claim_zid_dev_checkout(browser,revision_id) then raise exception 'double_claim'; end if;
 if public.prepare_zid_dev_checkout(browser,'zid-checkout-v1.fake','{}') then raise exception 'reset_creating'; end if;
 perform public.finish_zid_dev_checkout(browser,'UNKNOWN');
 if public.prepare_zid_dev_checkout(browser,'zid-checkout-v1.fake','{}') then raise exception 'reset_unknown'; end if;
 if public.claim_zid_dev_checkout(browser,revision_id) then raise exception 'unknown_retried'; end if;
 -- Fresh fixture: successful creation locks this session against more orders.
 delete from private.zid_dev_checkouts where session_hash=state_id;
 perform public.prepare_zid_dev_checkout(browser,'zid-checkout-v1.fake','{}');
 select revision into revision_id from private.zid_dev_checkouts where session_hash=state_id;
 perform public.claim_zid_dev_checkout(browser,revision_id);
 if not public.finish_zid_dev_checkout(browser,'CREATED','12345','zid-checkout-v1.result') then raise exception 'finish_failed'; end if;
 if public.prepare_zid_dev_checkout(browser,'zid-checkout-v1.fake','{}') then raise exception 'reset_created'; end if;
 if (public.get_zid_dev_checkout_session(browser)->'checkout'->>'order_id')<>'12345' then raise exception 'order_mapping_missing'; end if;
 update private.zid_dev_oauth_attempts set expires_at=now()-interval '1 second' where state_hash=state_id;
 if public.get_zid_dev_checkout_session(browser) is not null then raise exception 'expired_session_access'; end if;
 delete from private.zid_dev_oauth_attempts where state_hash=state_id;
 if not exists(select 1 from private.zid_dev_checkouts where session_hash=state_id and order_id='12345') then raise exception 'attribution_lost_on_expiry'; end if;
 -- An unresolved write must survive authorization expiry and block a fresh session.
 update private.zid_dev_checkouts set state='UNKNOWN' where session_hash=state_id;
 perform public.create_zid_dev_oauth_attempt(repeat('a',64),repeat('b',64));
 perform public.claim_zid_dev_oauth_attempt(repeat('a',64),repeat('b',64));
 perform public.finish_zid_dev_oauth_attempt(repeat('a',64),repeat('b',64),'3258532','testing-z',true,'zid-dev-v1.fake');
 perform public.prepare_zid_dev_checkout(repeat('b',64),'zid-checkout-v1.fake','{}');
 select revision into revision_id from private.zid_dev_checkouts where session_hash=repeat('a',64);
 if public.claim_zid_dev_checkout(repeat('b',64),revision_id) then raise exception 'reconnect_bypassed_unknown'; end if;
end $$;
