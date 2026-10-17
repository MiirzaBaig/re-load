-- Durable, sanitized receipt inbox. Receiving an event never grants paid access.
create table public.streampay_webhook_events (
  id uuid primary key default gen_random_uuid(),
  payload_digest text not null unique check (payload_digest ~ '^[a-f0-9]{64}$'),
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  provider_status text,
  provider_timestamp text,
  received_at timestamptz not null default now(),
  processing_status text not null default 'RECEIVED'
    check (processing_status in ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED'))
);
create index streampay_webhook_events_pending_idx
  on public.streampay_webhook_events (received_at) where processing_status = 'RECEIVED';
alter table public.streampay_webhook_events enable row level security;
revoke all on public.streampay_webhook_events from public, anon, authenticated;
grant select, insert, update on public.streampay_webhook_events to service_role;
