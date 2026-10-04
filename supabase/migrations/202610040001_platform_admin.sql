-- Reload staff access is separate from membership in a merchant store.
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'sales', 'viewer')),
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;
grant select on public.platform_admins to authenticated;
create policy "staff see own access" on public.platform_admins
  for select to authenticated using (user_id = (select auth.uid()));

create function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;
revoke all on function private.is_platform_admin() from public;
grant execute on function private.is_platform_admin() to authenticated;

create function private.can_manage_leads()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins
    where user_id = (select auth.uid()) and role in ('owner', 'sales'));
$$;
revoke all on function private.can_manage_leads() from public;
grant execute on function private.can_manage_leads() to authenticated;

-- AAL2 is checked in the database too: a bookmarked API request cannot skip MFA.
create function private.platform_mfa_verified()
returns boolean language sql stable set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;
revoke all on function private.platform_mfa_verified() from public;
grant execute on function private.platform_mfa_verified() to authenticated;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  store_name text not null check (char_length(trim(store_name)) between 1 and 120),
  contact_name text not null check (char_length(trim(contact_name)) between 1 and 120),
  email text,
  phone text,
  website text,
  store_platform text,
  interest text check (interest in ('returns', 'financing', 'both')),
  preferred_contact text check (preferred_contact in ('whatsapp', 'call', 'email')),
  source_type text not null check (source_type in ('website', 'event', 'qr', 'manual')),
  source_label text not null check (char_length(source_label) between 1 and 120),
  status text not null default 'new' check (status in ('new', 'contacted', 'interested', 'demo_booked', 'customer', 'not_interested')),
  owner_user_id uuid references auth.users(id) on delete set null,
  next_follow_up_at timestamptz,
  financing_request_id uuid unique references public.financing_requests(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  contact_consent boolean not null default false,
  marketing_consent boolean not null default false,
  partner_sharing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_has_contact check (email is not null or phone is not null)
);
create index leads_status_follow_up_idx on public.leads(status, next_follow_up_at);
create index leads_created_at_idx on public.leads(created_at desc);
alter table public.leads enable row level security;
revoke all on public.leads from anon, authenticated;
grant select on public.leads to authenticated;
grant insert (store_name, contact_name, email, phone, website, store_platform, interest, preferred_contact, source_type, source_label, contact_consent, marketing_consent, partner_sharing_consent) on public.leads to authenticated;
grant update (status, owner_user_id, next_follow_up_at) on public.leads to authenticated;
create policy "verified staff read leads" on public.leads for select to authenticated
  using (private.is_platform_admin() and private.platform_mfa_verified());
create policy "verified sales manage leads" on public.leads for update to authenticated
  using (private.can_manage_leads() and private.platform_mfa_verified())
  with check (private.can_manage_leads() and private.platform_mfa_verified());
create policy "verified sales import leads" on public.leads for insert to authenticated
  with check (private.can_manage_leads() and private.platform_mfa_verified()
    and source_type in ('event', 'manual') and not contact_consent
    and not marketing_consent and not partner_sharing_consent);

-- A short public form can be used behind an event QR code. It can only submit
-- an unassigned lead, never read the team inbox or claim financing consent.
grant insert (store_name, contact_name, email, phone, interest, source_type,
  source_label, contact_consent, marketing_consent) on public.leads to anon;
create policy "visitors can register interest" on public.leads for insert to anon, authenticated
  with check (source_type = 'qr' and source_label = 'Event signup'
    and status = 'new' and owner_user_id is null and store_id is null
    and financing_request_id is null and next_follow_up_at is null
    and contact_consent and not partner_sharing_consent
    and char_length(contact_name) between 1 and 120
    and (email is null or (char_length(email) <= 254 and email like '%@%.%'))
    and (phone is null or char_length(phone) between 7 and 25));

create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  author_user_id uuid not null references auth.users(id),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index lead_notes_lead_idx on public.lead_notes(lead_id, created_at desc);
alter table public.lead_notes enable row level security;
revoke all on public.lead_notes from anon, authenticated;
grant select, insert on public.lead_notes to authenticated;
create policy "verified staff read lead notes" on public.lead_notes for select to authenticated
  using (private.is_platform_admin() and private.platform_mfa_verified());
create policy "verified sales add lead notes" on public.lead_notes for insert to authenticated
  with check (private.can_manage_leads() and private.platform_mfa_verified()
    and author_user_id = (select auth.uid()));

create table public.platform_admin_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id),
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);
create index platform_admin_events_created_idx on public.platform_admin_events(created_at desc);
alter table public.platform_admin_events enable row level security;
revoke all on public.platform_admin_events from anon, authenticated;
grant select, insert on public.platform_admin_events to authenticated;
create policy "verified staff read admin events" on public.platform_admin_events for select to authenticated
  using (private.is_platform_admin() and private.platform_mfa_verified());
create policy "verified staff log own events" on public.platform_admin_events for insert to authenticated
  with check (private.is_platform_admin() and private.platform_mfa_verified()
    and actor_user_id = (select auth.uid()));

-- Existing merchant RLS remains intact; staff access requires MFA.
grant select on public.financing_requests to authenticated;
create policy "verified staff read financing" on public.financing_requests for select to authenticated
  using (private.is_platform_admin() and private.platform_mfa_verified());
create policy "verified staff read stores" on public.stores for select to authenticated
  using (private.is_platform_admin() and private.platform_mfa_verified());
create policy "verified staff read memberships" on public.memberships for select to authenticated
  using (private.is_platform_admin() and private.platform_mfa_verified());
create policy "verified staff read policies" on public.policy_versions for select to authenticated
  using (private.is_platform_admin() and private.platform_mfa_verified());
create policy "verified staff read decisions" on public.eligibility_decisions for select to authenticated
  using (private.is_platform_admin() and private.platform_mfa_verified());
create policy "verified staff read cases" on public.return_cases for select to authenticated
  using (private.is_platform_admin() and private.platform_mfa_verified());
create policy "verified staff read commerce connections" on public.commerce_connections for select to authenticated
  using (private.is_platform_admin() and private.platform_mfa_verified());
create policy "verified staff read whatsapp connections" on public.whatsapp_connections for select to authenticated
  using (private.is_platform_admin() and private.platform_mfa_verified());
create policy "verified staff read whatsapp messages" on public.whatsapp_messages for select to authenticated
  using (private.is_platform_admin() and private.platform_mfa_verified());
create policy "verified staff read integration events" on public.integration_events for select to authenticated
  using (private.is_platform_admin() and private.platform_mfa_verified());
create policy "verified staff read reports" on public.product_reports for select to authenticated
  using (private.is_platform_admin() and private.platform_mfa_verified());
create policy "verified staff read merchant audit" on public.audit_events for select to authenticated
  using (private.is_platform_admin() and private.platform_mfa_verified());

-- The existing form remains unchanged; a lead is created as part of its insert.
create function private.capture_financing_lead()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.leads (
    store_name, contact_name, email, phone, website, store_platform, interest,
    preferred_contact, source_type, source_label, financing_request_id,
    contact_consent, partner_sharing_consent, created_at
  ) values (
    new.store_name, new.contact_name, new.email, new.phone, new.website,
    new.store_platform, new.interest, new.preferred_contact, 'website',
    'Reload website', new.id, new.contact_consent,
    new.partner_sharing_consent, new.created_at
  );
  return new;
end;
$$;
revoke all on function private.capture_financing_lead() from public, anon, authenticated;
create trigger capture_financing_lead after insert on public.financing_requests
  for each row execute function private.capture_financing_lead();

-- Bring historical form requests into the same inbox, without altering them.
insert into public.leads (
  store_name, contact_name, email, phone, website, store_platform, interest,
  preferred_contact, source_type, source_label, financing_request_id,
  contact_consent, partner_sharing_consent, created_at
)
select store_name, contact_name, email, phone, website, store_platform, interest,
  preferred_contact, 'website', 'Reload website', id, contact_consent,
  partner_sharing_consent, created_at
from public.financing_requests
on conflict (financing_request_id) do nothing;
