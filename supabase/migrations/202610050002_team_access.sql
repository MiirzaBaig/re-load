-- Personal team logins (Google or email sign-in), managed by owners from the
-- desk. Access is invite-only: an owner adds an email and a role, and that
-- person gets desk access the first time they sign in with that email.

create function private.is_platform_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins
    where user_id = (select auth.uid()) and role = 'owner');
$$;
revoke all on function private.is_platform_owner() from public;
grant execute on function private.is_platform_owner() to authenticated;

-- Invitations ---------------------------------------------------------------
create table public.platform_admin_invites (
  email text primary key check (email = lower(trim(email)) and char_length(email) <= 254 and email like '%_@_%._%'),
  role text not null check (role in ('owner', 'sales', 'viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.platform_admin_invites enable row level security;
revoke all on public.platform_admin_invites from anon, authenticated;
grant select, insert, delete on public.platform_admin_invites to authenticated;
create policy "owners see invites" on public.platform_admin_invites for select to authenticated
  using (private.is_platform_owner());
create policy "owners invite" on public.platform_admin_invites for insert to authenticated
  with check (private.is_platform_owner() and invited_by = (select auth.uid()));
create policy "owners cancel invites" on public.platform_admin_invites for delete to authenticated
  using (private.is_platform_owner());

-- Owners manage the team ------------------------------------------------------
grant update (role), delete on public.platform_admins to authenticated;
create policy "owners see team" on public.platform_admins for select to authenticated
  using (private.is_platform_owner());
create policy "owners change roles" on public.platform_admins for update to authenticated
  using (private.is_platform_owner()) with check (private.is_platform_owner());
create policy "owners remove members" on public.platform_admins for delete to authenticated
  using (private.is_platform_owner() and user_id <> (select auth.uid()));

-- The desk always keeps at least one owner.
create function private.keep_an_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (select 1 from public.platform_admins where role = 'owner' and user_id <> old.user_id) then
    raise exception 'The team needs at least one owner.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function private.keep_an_owner() from public, anon, authenticated;
create trigger keep_an_owner before update or delete on public.platform_admins
  for each row execute function private.keep_an_owner();

-- Claiming an invite: called after sign-in. Only a confirmed email counts.
create function public.claim_platform_invite()
returns text language plpgsql security definer set search_path = '' as $$
declare
  user_email text;
  invited_role text;
begin
  select lower(email) into user_email from auth.users
    where id = (select auth.uid()) and email_confirmed_at is not null;
  if user_email is null then return null; end if;
  delete from public.platform_admin_invites where email = user_email returning role into invited_role;
  if invited_role is null then return null; end if;
  insert into public.platform_admins (user_id, role) values ((select auth.uid()), invited_role)
    on conflict (user_id) do update set role = excluded.role;
  insert into public.platform_admin_events (actor_user_id, event_type, entity_type)
    values ((select auth.uid()), 'INVITE_ACCEPTED', 'admin');
  return invited_role;
end;
$$;
revoke all on function public.claim_platform_invite() from public, anon;
grant execute on function public.claim_platform_invite() to authenticated;

-- The team, with names and emails, for staff only (auth.users isn't exposed).
create function public.list_platform_team()
returns table (user_id uuid, email text, full_name text, role text, joined_at timestamptz, last_sign_in_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.user_id, u.email::text,
    coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), '')),
    a.role, a.created_at, u.last_sign_in_at
  from public.platform_admins a join auth.users u on u.id = a.user_id
  where private.is_platform_admin()
  order by a.created_at;
$$;
revoke all on function public.list_platform_team() from public, anon;
grant execute on function public.list_platform_team() to authenticated;

-- New sign-ups get their own store, except invited teammates: they are Reload
-- staff, not merchants. (Otherwise every team login created a "My Store".)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  new_store_id uuid;
  requested_store_name text;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), '')));
  if exists (select 1 from public.platform_admin_invites where email = lower(new.email)) then
    return new;
  end if;
  requested_store_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'store_name'), ''), 'My Store');
  insert into public.stores (name) values (requested_store_name) returning id into new_store_id;
  insert into public.memberships (store_id, user_id, role) values (new_store_id, new.id, 'owner');
  return new;
end;
$$;
