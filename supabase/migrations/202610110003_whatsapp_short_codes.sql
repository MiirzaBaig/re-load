-- Public routing labels, never identity credentials. Legacy web return UUIDs stay intact.
alter table public.stores add column whatsapp_code text;
create unique index stores_whatsapp_code_idx on public.stores(whatsapp_code);
create function private.new_whatsapp_code() returns text
language plpgsql security definer set search_path='' as $$
declare candidate text;
begin
 -- Serialize generation so simultaneous signups cannot choose the same code.
 perform pg_catalog.pg_advisory_xact_lock(610110003);
 loop
  candidate := 'RL-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  exit when not exists(select 1 from public.stores where whatsapp_code=candidate);
 end loop;
 return candidate;
end $$;
revoke all on function private.new_whatsapp_code() from public,anon,authenticated;
do $$ declare store_row record; begin
 for store_row in select id from public.stores where whatsapp_code is null loop
  update public.stores set whatsapp_code=private.new_whatsapp_code() where id=store_row.id;
 end loop;
end $$;
alter table public.stores alter column whatsapp_code set not null;
alter table public.stores add constraint stores_whatsapp_code_format check(whatsapp_code ~ '^RL-[0-9A-F]{10}$');
create function private.assign_whatsapp_code() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then new.whatsapp_code:=private.new_whatsapp_code();
 elsif new.whatsapp_code is distinct from old.whatsapp_code then raise exception 'whatsapp_code_immutable';
 end if;
 return new;
end $$;
revoke all on function private.assign_whatsapp_code() from public,anon,authenticated;
create trigger store_whatsapp_code before insert or update of whatsapp_code on public.stores
 for each row execute function private.assign_whatsapp_code();

create function public.whatsapp_route_code(p_phone text,p_sender text,p_code text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare legacy uuid; cleaned text;
begin
 if p_code is null then return public.whatsapp_route(p_phone,p_sender,null::uuid); end if;
 cleaned:=upper(trim(p_code));
 if cleaned ~ '^RL-[0-9A-F]{10}$' then
  select return_code into legacy from public.stores where whatsapp_code=cleaned;
 elsif cleaned ~ '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$' then
  legacy:=cleaned::uuid;
 end if;
 if legacy is null then
  delete from private.whatsapp_routes where phone_number_id=p_phone and wa_id=p_sender;
  return null;
 end if;
 -- Existing routine checks active channel, phone, store and sender boundaries.
 return public.whatsapp_route(p_phone,p_sender,legacy);
end $$;
revoke all on function public.whatsapp_route_code(text,text,text) from public,anon,authenticated;
grant execute on function public.whatsapp_route_code(text,text,text) to service_role;
