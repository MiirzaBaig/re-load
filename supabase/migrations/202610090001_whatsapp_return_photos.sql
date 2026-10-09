-- A customer photo is evidence for a return, not a policy decision by itself.
-- Only the service role writes media; a merchant can read evidence for their store.

alter table private.whatsapp_flow_state
  drop constraint if exists whatsapp_flow_state_step_check;
alter table private.whatsapp_flow_state
  add constraint whatsapp_flow_state_step_check check (step in (
    'MENU','AWAITING_LANGUAGE','AWAITING_ORDER','AWAITING_ITEM','AWAITING_QUANTITY',
    'AWAITING_REASON','AWAITING_CONDITION','AWAITING_PHOTO','AWAITING_CONFIRMATION','COMPLETE',
    'POLICY_READY','AWAITING_POLICY_METHOD','AWAITING_POLICY_URL',
    'AWAITING_POLICY_TEXT','AWAITING_POLICY_WINDOW','REVIEWING_POLICY_RULE',
    'AWAITING_RULE_EDIT','AWAITING_POLICY_PUBLISH','ONBOARDING_PAUSED',
    'AWAITING_REPORT_MESSAGE','AWAITING_REPORT_CONFIRMATION'
  ));

alter table public.whatsapp_messages
  drop constraint if exists whatsapp_messages_message_type_check;
alter table public.whatsapp_messages
  add constraint whatsapp_messages_message_type_check check (
    message_type in ('TEXT','IMAGE','INTERACTIVE','FLOW','TEMPLATE','SYSTEM','UNSUPPORTED')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('return-evidence', 'return-evidence', false, 5242880, array['image/jpeg','image/png'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png'];

create table public.return_evidence (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  case_id uuid references public.return_cases(id) on delete set null,
  external_message_id text not null unique,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png')),
  assessment jsonb not null default '{}'::jsonb,
  review_required boolean not null default true,
  created_at timestamptz not null default now()
);
create index return_evidence_case_idx on public.return_evidence(case_id);
create index return_evidence_store_idx on public.return_evidence(store_id, created_at desc);

alter table public.return_evidence enable row level security;
revoke all on public.return_evidence from anon, authenticated;
grant select on public.return_evidence to authenticated;
create policy "members read return evidence" on public.return_evidence
  for select to authenticated using (private.is_store_member(store_id));

create policy "members view return photos" on storage.objects
  for select to authenticated using (
    bucket_id = 'return-evidence' and exists (
      select 1 from public.return_evidence evidence
      where evidence.storage_path = name and private.is_store_member(evidence.store_id)
    )
  );

-- Retire any earlier Meta sandbox assignment; the registered Saudi number is
-- assigned by a Reload platform owner after the pilot store is ready.
update public.whatsapp_connections
set status = 'DISCONNECTED', updated_at = now()
where phone_number_id <> '1418354908018050' and status = 'CONNECTED';

-- Queue a private image assessment after commit. A failed enqueue must not
-- invalidate the customer's saved photo or return request.
create or replace function private.queue_whatsapp_photo_analysis()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://clwczcvxosudfevjznmk.supabase.co/functions/v1/whatsapp-photo-analysis',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('evidenceId', new.id),
    timeout_milliseconds := 10000
  );
  return new;
exception when others then
  raise warning 'Unable to queue return photo analysis for %: %', new.id, sqlerrm;
  return new;
end;
$$;

revoke all on function private.queue_whatsapp_photo_analysis() from public, anon, authenticated;
create trigger return_photo_analysis
after insert on public.return_evidence
for each row execute function private.queue_whatsapp_photo_analysis();
