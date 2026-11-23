-- ------- Southwest Home Maintenance portal: access rules and photo storage -------
-- Why this matters: the Supabase project is shared, so "logged in" is not enough.
-- A user from another app is also "authenticated". Every rule below checks that
-- the person is in shm_portal.staff.

-- ------- Who is asking -------
create or replace function shm_portal.request_uid()
returns uuid
language sql
stable
set search_path = pg_catalog, pg_temp
as $$
  select nullif(coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  ), '')::uuid;
$$;

-- security definer so the check can read staff without tripping its own RLS.
create or replace function shm_portal.is_staff()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, shm_portal, pg_temp
as $$
  select exists (select 1 from staff where id = request_uid() and active);
$$;

create or replace function shm_portal.is_owner()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, shm_portal, pg_temp
as $$
  select exists (select 1 from staff where id = request_uid() and active and role = 'owner');
$$;

-- ------- Grants -------
-- No grants to anon at all: nothing in this schema is readable without a login.
-- The customer report page is rendered on the server with the service role.
grant usage on schema shm_portal to authenticated, service_role;
grant select, insert, update, delete on all tables in schema shm_portal to authenticated;
grant all on all tables in schema shm_portal to service_role;
grant usage, select on all sequences in schema shm_portal to authenticated, service_role;
revoke all on shm_portal._migration_history from authenticated;
revoke all on all functions in schema shm_portal from public;
grant execute on all functions in schema shm_portal to authenticated, service_role;

-- ------- Row level security -------
alter table shm_portal.staff enable row level security;
alter table shm_portal.customers enable row level security;
alter table shm_portal.homes enable row level security;
alter table shm_portal.home_equipment enable row level security;
alter table shm_portal.home_supplies enable row level security;
alter table shm_portal.home_tasks enable row level security;
alter table shm_portal.visits enable row level security;
alter table shm_portal.visit_items enable row level security;
alter table shm_portal.visit_photos enable row level security;
alter table shm_portal.visit_readings enable row level security;
alter table shm_portal.visit_supplies enable row level security;
alter table shm_portal.message_log enable row level security;
alter table shm_portal._migration_history enable row level security;

-- Staff list: everyone on the team can read it, only owners change it.
create policy staff_read on shm_portal.staff
  for select to authenticated using (shm_portal.is_staff());
create policy staff_manage on shm_portal.staff
  for all to authenticated using (shm_portal.is_owner()) with check (shm_portal.is_owner());

-- Customers, homes and visits: staff read and write, only owners delete.
do $$
declare t text;
begin
  foreach t in array array['customers', 'homes', 'visits'] loop
    execute format('create policy %I on shm_portal.%I for select to authenticated using (shm_portal.is_staff())', t || '_select', t);
    execute format('create policy %I on shm_portal.%I for insert to authenticated with check (shm_portal.is_staff())', t || '_insert', t);
    execute format('create policy %I on shm_portal.%I for update to authenticated using (shm_portal.is_staff()) with check (shm_portal.is_staff())', t || '_update', t);
    execute format('create policy %I on shm_portal.%I for delete to authenticated using (shm_portal.is_owner())', t || '_delete', t);
  end loop;
end $$;

-- Working records a tech adds and removes during a visit: staff can do everything.
do $$
declare t text;
begin
  foreach t in array array['home_equipment', 'home_supplies', 'home_tasks', 'visit_items', 'visit_photos', 'visit_readings', 'visit_supplies'] loop
    execute format('create policy %I on shm_portal.%I for all to authenticated using (shm_portal.is_staff()) with check (shm_portal.is_staff())', t || '_staff', t);
  end loop;
end $$;

-- Email log: staff can read it and add to it, nobody edits it.
create policy message_log_read on shm_portal.message_log
  for select to authenticated using (shm_portal.is_staff());
create policy message_log_insert on shm_portal.message_log
  for insert to authenticated with check (shm_portal.is_staff());

-- ------- Photo storage -------
-- Private bucket. Photos are only reachable through short-lived signed links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shm-visit-photos', 'shm-visit-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy shm_visit_photos_obj_read on storage.objects
  for select to authenticated
  using (bucket_id = 'shm-visit-photos' and shm_portal.is_staff());
create policy shm_visit_photos_obj_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'shm-visit-photos' and shm_portal.is_staff());
create policy shm_visit_photos_obj_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'shm-visit-photos' and shm_portal.is_staff());

insert into shm_portal._migration_history (version) values ('20261123000001_rls_and_storage.sql');
