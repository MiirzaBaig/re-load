-- The first team account is granted access only after Supabase confirms
-- ownership of the designated mailbox. Passwords stay entirely in Auth.
create function private.bootstrap_team_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if lower(new.email) = 'admin@reload.sa' and new.email_confirmed_at is not null then
    insert into public.platform_admins (user_id, role)
    values (new.id, 'owner')
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.bootstrap_team_admin() from public, anon, authenticated;
create trigger bootstrap_team_admin
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function private.bootstrap_team_admin();

insert into public.platform_admins (user_id, role)
select id, 'owner' from auth.users
where lower(email) = 'admin@reload.sa' and email_confirmed_at is not null
on conflict (user_id) do nothing;
