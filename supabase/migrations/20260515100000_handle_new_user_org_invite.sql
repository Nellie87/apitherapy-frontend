-- When an admin invites a user via inviteUserByEmail with user_metadata:
--   invited_org_id (uuid text), invited_role (e.g. sales_clerk)
-- attach them to the org after auth.users insert (same moment as profiles).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org text;
  v_role text;
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), '')
  )
  on conflict (id) do nothing;

  v_org := new.raw_user_meta_data->>'invited_org_id';
  v_role := lower(trim(coalesce(new.raw_user_meta_data->>'invited_role', 'sales_clerk')));

  if v_org is not null and v_org ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    if v_role not in ('sales_clerk', 'cashier', 'pos') then
      v_role := 'sales_clerk';
    end if;

    insert into public.org_members (org_id, user_id, role)
    values (v_org::uuid, new.id, v_role)
    on conflict (org_id, user_id) do update
      set role = excluded.role;
  end if;

  return new;
end;
$$;

-- Trigger name unchanged from your setup; recreate if you use a different name.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
