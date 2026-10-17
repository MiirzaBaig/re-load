-- Run in the isolated billing test transaction after billing.sql fixtures, before rollback.
do $$
declare c public.billing_checkouts; b public.store_billing; snap jsonb; failed boolean; r uuid; original_start timestamptz; begin
 if public.billing_month_start('2024-01-31 12:00Z','2024-02-29 12:00Z')<>'2024-02-29 12:00Z'::timestamptz then raise exception 'Leap year month boundary failed'; end if;
 if public.billing_month_end('2024-01-31 12:00Z','2024-02-29 12:00Z')<>'2024-03-31 12:00Z'::timestamptz then raise exception 'Month end anchor drifted'; end if;
 if public.billing_month_start('2025-01-31 12:00Z','2025-02-28 11:59Z')<>'2025-01-31 12:00Z'::timestamptz then raise exception 'Reset occurred early'; end if;
 if public.billing_month_start('2025-01-31 12:00Z','2025-03-30 12:00Z')<>'2025-02-28 12:00Z'::timestamptz then raise exception 'Clamped reset drifted'; end if;
 -- Unpaid annual link, concurrent tabs, tampered interval and cross-owner checks.
 c:=public.billing_start_checkout('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','live','22222222-2222-4222-8222-222222222222','standard','SUBSCRIPTION','annual');
 if c.amount_halalas<>143040 or c.launch_offer then raise exception 'Annual price or offer incorrect'; end if;
 if public.billing_start_checkout(c.store_id,'live',c.user_id,'standard','SUBSCRIPTION','annual')<>c then raise exception 'Multiple tabs created another checkout';end if;
 failed:=false;begin perform public.billing_start_checkout(c.store_id,'live',c.user_id,'standard','SUBSCRIPTION','monthly');exception when others then failed:=sqlerrm='checkout_in_progress';end;if not failed then raise exception 'Conflicting checkout allowed';end if;
 failed:=false;begin perform public.billing_start_checkout(c.store_id,'sandbox',c.user_id,'standard','SUBSCRIPTION','weekly');exception when others then failed:=sqlerrm='invalid_checkout';end;if not failed then raise exception 'Unsupported interval allowed';end if;
 failed:=false;begin perform public.billing_start_checkout(c.store_id,'sandbox','11111111-1111-4111-8111-111111111111','standard','SUBSCRIPTION','annual');exception when others then failed:=sqlerrm='insufficient_permission';end;if not failed then raise exception 'Cross-owner checkout allowed';end if;
 failed:=false;begin perform public.billing_reserve_message(c.store_id,'unpaid-annual');exception when others then failed:=sqlerrm='subscription_required';end;if not failed then raise exception 'Unpaid checkout unlocked';end if;
 update public.billing_checkouts set status='READY' where id=c.id;
 original_start:=date_trunc('day',now())-interval '2 months 1 day';
 perform public.billing_apply_invoice(c.id,'12345678-1234-4234-8234-123456789001','12345678-1234-4234-8234-123456789002',original_start,original_start+interval '1 year',0,143040,'standard','annual');
 snap:=public.billing_snapshot(c.store_id,'live');
 if snap->>'billingInterval'<>'annual' or (snap->>'included')::int<>500 or (snap->>'allowanceStart')::timestamptz<=original_start then raise exception 'Annual message allowance failed';end if;
 insert into public.billing_message_usage(store_id,message_key,period_start,bucket,state) values(c.store_id,'previous-month-only',original_start,'INCLUDED','DELIVERED');
 if (public.billing_snapshot(c.store_id,'live')->>'used')::int<>0 then raise exception 'Previous month usage carried into annual month';end if;
 r:=public.billing_reserve_message(c.store_id,'new-annual-month');
 if (select period_start from public.billing_message_usage where id=r)<>public.billing_month_start(original_start,now()) then raise exception 'Usage used annual payment period';end if;
 -- A failed renewal cannot extend paid time; cancelled accounts retain already paid time.
 update public.store_billing set status='CANCELED' where store_id=c.store_id and environment='live';
 perform public.billing_reserve_message(c.store_id,'cancelled-but-paid');
 update public.store_billing set status='ACTIVE' where store_id=c.store_id and environment='live';
 perform public.billing_request_interval(c.store_id,'live',c.user_id,'monthly');
 failed:=false;begin perform public.billing_start_checkout(c.store_id,'live',c.user_id,'premium','UPGRADE','annual');exception when others then failed:=sqlerrm='scheduled_change_exists';end;if not failed then raise exception 'Upgrade conflicted with scheduled billing change';end if;
 update public.store_billing set pending_interval=null where store_id=c.store_id and environment='live';
 c:=public.billing_start_checkout(c.store_id,'live',c.user_id,'premium','UPGRADE','annual');
 if c.amount_halalas<100000 or c.amount_halalas>144000 or c.upgrade_messages<0 or c.upgrade_messages>1500 then raise exception 'Annual upgrade proration incorrect';end if;
 update public.billing_checkouts set status='READY' where id=c.id;
 perform public.billing_apply_invoice(c.id,'12345678-1234-4234-8234-123456789003',null,null,null,0,c.amount_halalas,null,'annual');
 select * into b from public.store_billing where store_id=c.store_id and environment='live';
 if b.plan<>'premium' or b.period_start<>original_start or b.billing_interval<>'annual' then raise exception 'Upgrade changed paid year';end if;
 -- Monthly upgrade bonus naturally disappears at the next message reset, without waiting a year.
 update public.store_billing set override_period_start=original_start where store_id=c.store_id and environment='live';
 if (public.billing_snapshot(c.store_id,'live')->>'included')::int<>2000 then raise exception 'Upgrade bonus persisted across allowance months';end if;
 raise notice 'PASS: annual prices, leap/month-end resets, tab dedupe, invalid input, tenant guards, unpaid access, monthly usage, cancellation, scheduling and annual upgrade';
end $$;

do $$declare c public.billing_checkouts; old_start timestamptz; old_end timestamptz; begin
 perform set_config('test.auth_role','service_role',true);
 select * into c from public.billing_checkouts where store_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and environment='live' and kind='SUBSCRIPTION' limit 1;
 update public.store_billing set status='ACTIVE',period_start=now()-interval '1 day' where store_id=c.store_id and environment='live';
 select period_start,period_end into old_start,old_end from public.store_billing where store_id=c.store_id and environment='live';
 perform public.billing_apply_invoice(c.id,'12345678-1234-4234-8234-123456789010','66666666-6666-4666-8666-666666666666',old_end,old_end+interval '1 year',0,287040,'premium','annual');
 if (public.billing_snapshot(c.store_id,'live')->>'periodStart')::timestamptz<>old_start then raise exception 'Early renewal interrupted paid period';end if;
 if (select count(*) from public.billing_payments where invoice_id='12345678-1234-4234-8234-123456789010')<>1 then raise exception 'Future payment was not recorded';end if;
 -- Move the already verified period boundary into the past to exercise activation without advancing the system clock.
 update public.billing_payments set period_start=now()-interval '1 hour',period_end=now()+interval '1 year' where invoice_id='12345678-1234-4234-8234-123456789010';
 if (public.billing_snapshot(c.store_id,'live')->>'billingInterval')<>'annual' then raise exception 'Due paid renewal failed to activate';end if;
 if (public.billing_snapshot(c.store_id,'live')->>'included')::int<>2000 then raise exception 'Due renewal retained prorated allowance';end if;
 raise notice 'PASS: early paid renewal preserves existing time; paid ledger activates at its boundary exactly once';
end $$;
