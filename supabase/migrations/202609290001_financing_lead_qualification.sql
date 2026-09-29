-- Qualify financing leads the way the sales conversation needs them: what the
-- merchant cares about, how they want to be reached, and whether they allow
-- their details to be shared with a financing partner.
--
-- Partner sharing is a separate, optional consent. Agreeing to be contacted
-- by Reload is not the same as agreeing to have details passed to a lender,
-- so the two are recorded independently and the insert policy (which requires
-- contact_consent) is deliberately left unchanged.

alter table public.financing_requests
  add column website text check (char_length(website) <= 200),
  add column interest text check (interest in ('returns', 'financing', 'both')),
  add column preferred_contact text check (preferred_contact in ('whatsapp', 'call', 'email')),
  add column partner_sharing_consent boolean not null default false;
