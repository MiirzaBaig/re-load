-- Private language preference only. Public visitors never become merchant contacts.
create table private.whatsapp_public_visitors (
 phone_id text not null, sender text not null, language text not null check(language in ('ar','en')),
 expires_at timestamptz not null default now()+interval '24 hours', primary key(phone_id,sender)
);
revoke all on private.whatsapp_public_visitors from public,anon,authenticated;
create function public.whatsapp_public_language(p_phone text,p_sender text,p_language text default null)
returns text language plpgsql security definer set search_path='' as $$
declare result text;
begin
 if nullif(p_phone,'') is null or nullif(p_sender,'') is null then raise exception 'invalid_visitor'; end if;
 if p_language is not null then
  if p_language not in ('ar','en') then raise exception 'invalid_language'; end if;
  delete from private.whatsapp_public_visitors where expires_at<now();
  insert into private.whatsapp_public_visitors(phone_id,sender,language) values(p_phone,p_sender,p_language)
  on conflict(phone_id,sender) do update set language=excluded.language,expires_at=now()+interval '24 hours';
  return p_language;
 end if;
 select language into result from private.whatsapp_public_visitors where phone_id=p_phone and sender=p_sender and expires_at>now();
 return result;
end $$;
revoke all on function public.whatsapp_public_language(text,text,text) from public,anon,authenticated;
grant execute on function public.whatsapp_public_language(text,text,text) to service_role;
