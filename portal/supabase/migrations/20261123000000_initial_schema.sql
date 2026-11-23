-- ------- Southwest Home Maintenance portal: tables -------
-- Everything lives in its own schema (shm_portal) because this Supabase project
-- is shared with other apps. Nothing here touches another schema.

create schema if not exists shm_portal;

-- ------- Enums -------
create type shm_portal.staff_role as enum ('owner', 'tech');
create type shm_portal.plan_tier as enum ('essentials', 'plus', 'premier');
create type shm_portal.home_status as enum ('active', 'paused', 'cancelled');
create type shm_portal.visit_type as enum ('assessment', 'maintenance');
create type shm_portal.visit_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');
create type shm_portal.item_status as enum ('pending', 'done', 'attention', 'na');

-- ------- Staff -------
-- id is the Supabase Auth user id, so "is this person staff?" is one lookup.
create table shm_portal.staff (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text,
  role shm_portal.staff_role not null default 'tech',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------- Customers and homes -------
-- A customer can have more than one home (second homes, a parent's house).
create table shm_portal.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  notes text,
  created_by uuid references shm_portal.staff (id) on delete set null,
  created_at timestamptz not null default now()
);

create table shm_portal.homes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references shm_portal.customers (id) on delete cascade,
  address text not null,
  city text not null default 'Las Vegas',
  state text not null default 'NV',
  zip text,
  plan shm_portal.plan_tier not null default 'essentials',
  status shm_portal.home_status not null default 'active',
  member_since date,
  -- What the home has (pool, solar, softener...). Decides which checklist items apply.
  features text[] not null default '{}',
  -- Gate codes, pets, where to park. Shown to the tech at the top of every visit.
  access_notes text,
  -- Where the shutoffs are: { main_water, water_heater, gas, irrigation, panel }
  shutoffs jsonb not null default '{}',
  -- Family member who gets a copy of each report, only with the customer's permission.
  report_cc_name text,
  report_cc_email text,
  report_cc_ok boolean not null default false,
  created_at timestamptz not null default now()
);
create index homes_customer_idx on shm_portal.homes (customer_id);

-- ------- Home profile: equipment, supplies, the customer's task list -------
create table shm_portal.home_equipment (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references shm_portal.homes (id) on delete cascade,
  kind text not null,
  make text,
  model text,
  serial text,
  install_year int,
  location text,
  notes text,
  created_at timestamptz not null default now()
);
create index home_equipment_home_idx on shm_portal.home_equipment (home_id);

create table shm_portal.home_supplies (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references shm_portal.homes (id) on delete cascade,
  kind text not null,
  spec text not null,
  qty int not null default 1,
  location text,
  created_at timestamptz not null default now()
);
create index home_supplies_home_idx on shm_portal.home_supplies (home_id);

-- ------- Visits -------
create table shm_portal.visits (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references shm_portal.homes (id) on delete cascade,
  tech_id uuid references shm_portal.staff (id) on delete set null,
  visit_type shm_portal.visit_type not null default 'maintenance',
  -- Position in the plan year (1..visits per year). Decides which items are due.
  seq int not null default 1,
  -- The plan at the time of the visit, so old reports stay correct after an upgrade.
  plan shm_portal.plan_tier not null,
  status shm_portal.visit_status not null default 'scheduled',
  scheduled_for timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  -- The tech's note to the customer, shown at the top of the report.
  summary text,
  -- Unguessable token for the customer's report link.
  report_token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  report_sent_at timestamptz,
  created_by uuid references shm_portal.staff (id) on delete set null,
  created_at timestamptz not null default now()
);
create index visits_home_idx on shm_portal.visits (home_id);
create index visits_scheduled_idx on shm_portal.visits (scheduled_for);
create index visits_tech_idx on shm_portal.visits (tech_id);

-- The checklist is copied onto the visit when it is scheduled, so later edits to
-- the master checklist never rewrite a visit that already happened.
create table shm_portal.visit_items (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references shm_portal.visits (id) on delete cascade,
  category_id text not null,
  category_title text not null,
  name text not null,
  detail text,
  kind text not null check (kind in ('do', 'check')),
  minutes int,
  sort int not null default 0,
  status shm_portal.item_status not null default 'pending',
  note text,
  updated_by uuid references shm_portal.staff (id) on delete set null,
  updated_at timestamptz
);
create index visit_items_visit_idx on shm_portal.visit_items (visit_id);

create table shm_portal.visit_photos (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references shm_portal.visits (id) on delete cascade,
  item_id uuid references shm_portal.visit_items (id) on delete set null,
  storage_path text not null unique,
  caption text,
  width int,
  height int,
  taken_by uuid references shm_portal.staff (id) on delete set null,
  created_at timestamptz not null default now()
);
create index visit_photos_visit_idx on shm_portal.visit_photos (visit_id);

-- Measurements taken on a visit (water pressure, hot water temperature, hardness).
create table shm_portal.visit_readings (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references shm_portal.visits (id) on delete cascade,
  key text not null,
  value numeric not null,
  unique (visit_id, key)
);

-- Parts we supplied on a visit (filters, batteries, bulbs).
create table shm_portal.visit_supplies (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references shm_portal.visits (id) on delete cascade,
  name text not null,
  qty int not null default 1,
  created_at timestamptz not null default now()
);
create index visit_supplies_visit_idx on shm_portal.visit_supplies (visit_id);

-- The customer's list of little jobs. Open ones show up on the next visit.
create table shm_portal.home_tasks (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references shm_portal.homes (id) on delete cascade,
  title text not null,
  status text not null default 'open' check (status in ('open', 'done')),
  minutes int,
  done_visit_id uuid references shm_portal.visits (id) on delete set null,
  done_at timestamptz,
  created_by uuid references shm_portal.staff (id) on delete set null,
  created_at timestamptz not null default now()
);
create index home_tasks_home_idx on shm_portal.home_tasks (home_id);

-- ------- Email log -------
create table shm_portal.message_log (
  id bigint generated always as identity primary key,
  visit_id uuid references shm_portal.visits (id) on delete set null,
  template text not null,
  recipient text not null,
  status text not null,
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);

-- ------- Migration bookkeeping -------
create table shm_portal._migration_history (
  version text primary key,
  applied_at timestamptz not null default now()
);
insert into shm_portal._migration_history (version) values ('20261123000000_initial_schema.sql');
