-- Test helpers are created only inside this rollback-only isolated fixture.
create schema auth;
create function auth.uid() returns uuid language sql as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;
create function private.is_platform_owner() returns boolean language sql as $$select current_setting('test.staff_role',true)='owner'$$;
create function private.platform_mfa_verified() returns boolean language sql as $$select coalesce(current_setting('test.mfa',true),'yes')<>'no'$$;
create table public.platform_admin_events(actor_user_id uuid,event_type text,entity_type text,created_at timestamptz default now());
\i supabase/migrations/202610240002_admin_checkout_monitor.sql

do $$
declare snapshot jsonb; events integer;
begin
 if has_function_privilege('anon','public.staff_checkout_monitor()','execute') or has_table_privilege('authenticated','private.zid_checkout_activity','select') or has_function_privilege('authenticated','public.record_zid_dev_checkout_observation(text,text,text,text,integer)','execute') then raise exception 'public_access'; end if;
 perform set_config('test.staff_role','viewer',true);
 begin perform public.staff_checkout_monitor();raise exception 'viewer_accepted';exception when insufficient_privilege then null;end;
 perform set_config('test.staff_role','sales',true);
 begin perform public.staff_checkout_monitor();raise exception 'sales_accepted';exception when insufficient_privilege then null;end;
 perform set_config('test.staff_role','owner',true);perform set_config('test.mfa','no',true);
 begin perform public.staff_checkout_monitor();raise exception 'mfa_bypass';exception when insufficient_privilege then null;end;
 perform set_config('test.mfa','yes',true);
 snapshot:=public.staff_checkout_monitor();
 if snapshot->>'environment'<>'development' or jsonb_array_length(snapshot->'records')<1 then raise exception 'snapshot_missing';end if;
 if snapshot::text ~ '(ciphertext|session_hash|token|email|phone|address)' then raise exception 'private_fields';end if;
 if exists(select 1 from jsonb_array_elements(snapshot->'records')r where jsonb_array_length(r->'events')<>0) then raise exception 'invented_history';end if;
 perform public.staff_checkout_monitor();
 if (select count(*) from public.platform_admin_events)<>1 then raise exception 'audit_poll_spam';end if;
 -- Existing fixtures leave a fresh READY record and another UNKNOWN lock. No reset here.
 update private.zid_dev_checkouts set state='FAILED',updated_at=now() where session_hash=repeat('a',64);
 if not exists(select 1 from private.zid_checkout_activity where session_hash=repeat('a',64) and stage='attempt_failed') then raise exception 'state_not_recorded';end if;
 if public.record_zid_dev_checkout_observation(repeat('f',64),'create_request','unconfirmed','provider_unknown',500) then raise exception 'wrong_browser';end if;
 if not public.record_zid_dev_checkout_observation(repeat('b',64),'create_request','failed','provider_unknown',500) then raise exception 'observation_failed';end if;
 perform public.record_zid_dev_checkout_observation(repeat('b',64),'create_request','failed','provider_unknown',500);
 if (select count(*) from private.zid_checkout_activity where stage='create_request')<>1 then raise exception 'observation_not_deduped';end if;
 begin perform public.record_zid_dev_checkout_observation(repeat('b',64),'create_request','failed','private@example.com',500);raise exception 'raw_text_accepted';exception when raise_exception then if SQLERRM='raw_text_accepted' then raise;end if;end;
 begin perform public.record_zid_dev_checkout_observation(repeat('b',64),'payment_checked','paid');raise exception 'paid_failed_order';exception when raise_exception then if SQLERRM='paid_failed_order' then raise;end if;end;
 snapshot:=public.staff_checkout_monitor();
 if snapshot::text like '%private@example.com%' then raise exception 'raw_error_leak';end if;
 if not exists(select 1 from private.zid_dev_checkouts where session_hash=repeat('d',64) and state='UNKNOWN') then raise exception 'lock_changed';end if;
end $$;
