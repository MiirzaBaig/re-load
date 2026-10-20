-- The homepage "Talk to us" form (name, mobile, store link) may also create
-- a lead, alongside the event sign-up. Same limits as the event form, plus
-- the store link column. Applied in the SQL editor on 2026-10-20; both
-- statements are safe to run again.
grant insert (website, preferred_contact) on public.leads to anon;

alter policy "visitors can register interest" on public.leads
  with check (
    ((source_type = 'qr' and source_label = 'Event signup')
      or (source_type = 'website' and source_label = 'Homepage contact'))
    and status = 'new' and owner_user_id is null and store_id is null
    and financing_request_id is null and next_follow_up_at is null
    and contact_consent and not partner_sharing_consent
    and char_length(contact_name) between 1 and 120
    and (email is null or (char_length(email) <= 254 and email like '%@%.%'))
    and (phone is null or char_length(phone) between 7 and 25)
    and (website is null or char_length(website) <= 200)
    and (preferred_contact is null or preferred_contact = 'whatsapp')
    and (store_platform is null or store_platform in ('Salla', 'Zid', 'Shopify', 'Other')));
