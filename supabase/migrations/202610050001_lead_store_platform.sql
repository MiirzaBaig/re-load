-- Event sign-ups can say which platform the store runs on, so the team can
-- see the Salla / Zid / Shopify split without asking each merchant again.
-- The public form may only send one of four fixed answers (or nothing).
grant insert (store_platform) on public.leads to anon;

alter policy "visitors can register interest" on public.leads
  with check (source_type = 'qr' and source_label = 'Event signup'
    and status = 'new' and owner_user_id is null and store_id is null
    and financing_request_id is null and next_follow_up_at is null
    and contact_consent and not partner_sharing_consent
    and char_length(contact_name) between 1 and 120
    and (email is null or (char_length(email) <= 254 and email like '%@%.%'))
    and (phone is null or char_length(phone) between 7 and 25)
    and (store_platform is null or store_platform in ('Salla', 'Zid', 'Shopify', 'Other')));

-- The team can record or correct a lead's platform from the desk. Row access
-- is still decided by the existing "verified sales manage leads" policy.
grant update (store_platform) on public.leads to authenticated;
