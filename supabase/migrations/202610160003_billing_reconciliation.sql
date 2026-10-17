alter table public.streampay_webhook_events add column processing_attempts integer not null default 0;
create function private.dispatch_billing_reconciliation() returns void
language plpgsql security definer set search_path='' as $$
declare ticket uuid:=gen_random_uuid(); begin
 if not exists(select 1 from public.streampay_webhook_events where processing_status in ('RECEIVED','FAILED') and processing_attempts<12 and received_at>now()-interval '7 days') then return; end if;
 insert into private.whatsapp_worker_tickets values(ticket,now()+interval '5 minutes');
 perform net.http_post(url:='https://clwczcvxosudfevjznmk.supabase.co/functions/v1/billing-reconcile',headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('ticket',ticket),timeout_milliseconds:=60000);
end $$;
revoke all on function private.dispatch_billing_reconciliation() from public,anon,authenticated;
select cron.schedule('reload-billing-reconciliation','*/10 * * * *','select private.dispatch_billing_reconciliation()');
