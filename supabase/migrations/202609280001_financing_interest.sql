-- Extend existing interest records without changing access to private leads.
alter table public.financing_requests
  add column store_platform text check (char_length(store_platform) between 1 and 120),
  add column monthly_sales numeric(12,2) check (monthly_sales >= 0),
  add column monthly_orders integer check (monthly_orders between 0 and 100000000),
  add column return_rate numeric(5,2) check (return_rate between 0 and 100),
  add column average_refund_amount numeric(12,2) check (average_refund_amount >= 0),
  add column monthly_refund_volume numeric(12,2) check (monthly_refund_volume >= 0),
  add column refund_processing_days numeric(5,2) check (refund_processing_days between 0 and 365),
  add column desired_financing_days integer check (desired_financing_days between 0 and 365),
  add column contact_consent boolean not null default false;

-- Historical rows are retained; all new public submissions require consent.
alter policy "anon can submit a financing request" on public.financing_requests
  with check (contact_consent = true and store_platform is not null
    and length(trim(store_name)) > 0 and length(trim(contact_name)) > 0
    and status = 'new');
