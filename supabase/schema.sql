-- ============================================================
-- Paradise Grocers — MVP Schema + RLS
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS /
-- CREATE OR REPLACE / DROP POLICY IF EXISTS before CREATE POLICY).
-- ============================================================

-- 1. profiles — one row per authenticated user, id = auth.users.id
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 2. households
create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- 3. household_members — connects users to households
create table if not exists household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

-- 4. recipes — the main recipe card table
create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  meal_icon text,
  protein_icon text,
  method_icon text,
  servings integer,
  prep_minutes integer,
  cook_minutes integer,
  is_active boolean not null default true,
  is_favorite boolean not null default false,
  is_current_week boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. ingredients — master ingredient library, one per household
create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  category text,
  subcategory text,
  default_unit text,
  default_store text,
  image_url text,
  is_common boolean not null default false,
  created_at timestamptz not null default now(),
  unique (household_id, normalized_name)
);

-- 6. recipe_ingredients — connects ingredients to recipes
create table if not exists recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete restrict,
  quantity_value numeric,
  quantity_unit text,
  store_name text,
  notes text,
  created_at timestamptz not null default now()
);

-- 7. recipe_steps — recipe directions
create table if not exists recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  step_order integer not null,
  title text,
  description text,
  image_url text,
  created_at timestamptz not null default now()
);

-- 8. weekly_menus — a household's weekly meal plan
create table if not exists weekly_menus (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  week_start date not null,
  created_at timestamptz not null default now(),
  unique (household_id, week_start)
);

-- 9. weekly_menu_recipes — connects recipes to a weekly menu
create table if not exists weekly_menu_recipes (
  id uuid primary key default gen_random_uuid(),
  weekly_menu_id uuid not null references weekly_menus(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete cascade,
  meal_day text,
  meal_order integer,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles enable row level security;
alter table households enable row level security;
alter table household_members enable row level security;
alter table recipes enable row level security;
alter table ingredients enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_steps enable row level security;
alter table weekly_menus enable row level security;
alter table weekly_menu_recipes enable row level security;

-- Helper: is the current logged-in user a member of this household?
create or replace function is_household_member(hh_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from household_members
    where household_id = hh_id and user_id = auth.uid()
  );
$$;

-- profiles: a user can only see/edit their own profile row
drop policy if exists "profiles: self select" on profiles;
create policy "profiles: self select" on profiles for select using (id = auth.uid());

drop policy if exists "profiles: self insert" on profiles;
create policy "profiles: self insert" on profiles for insert with check (id = auth.uid());

drop policy if exists "profiles: self update" on profiles;
create policy "profiles: self update" on profiles for update using (id = auth.uid());

-- households: visible/editable only to members; any signed-in user can create one
drop policy if exists "households: member select" on households;
create policy "households: member select" on households for select using (is_household_member(id));

drop policy if exists "households: any insert" on households;
create policy "households: any insert" on households for insert with check (auth.uid() is not null);

drop policy if exists "households: member update" on households;
create policy "households: member update" on households for update using (is_household_member(id));

-- household_members: a user sees their own membership rows, plus their household's other members
drop policy if exists "household_members: select" on household_members;
create policy "household_members: select" on household_members for select using (
  user_id = auth.uid() or is_household_member(household_id)
);

drop policy if exists "household_members: self insert" on household_members;
create policy "household_members: self insert" on household_members for insert with check (user_id = auth.uid());

drop policy if exists "household_members: member delete" on household_members;
create policy "household_members: member delete" on household_members for delete using (is_household_member(household_id));

-- recipes / ingredients: scoped directly by household_id
drop policy if exists "recipes: member all" on recipes;
create policy "recipes: member all" on recipes for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

drop policy if exists "ingredients: member all" on ingredients;
create policy "ingredients: member all" on ingredients for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- recipe_ingredients / recipe_steps: scoped via their parent recipe's household
drop policy if exists "recipe_ingredients: member all" on recipe_ingredients;
create policy "recipe_ingredients: member all" on recipe_ingredients for all
  using (exists (select 1 from recipes r where r.id = recipe_id and is_household_member(r.household_id)))
  with check (exists (select 1 from recipes r where r.id = recipe_id and is_household_member(r.household_id)));

drop policy if exists "recipe_steps: member all" on recipe_steps;
create policy "recipe_steps: member all" on recipe_steps for all
  using (exists (select 1 from recipes r where r.id = recipe_id and is_household_member(r.household_id)))
  with check (exists (select 1 from recipes r where r.id = recipe_id and is_household_member(r.household_id)));

-- weekly_menus: scoped directly by household_id
drop policy if exists "weekly_menus: member all" on weekly_menus;
create policy "weekly_menus: member all" on weekly_menus for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- weekly_menu_recipes: scoped via its parent weekly_menu's household
drop policy if exists "weekly_menu_recipes: member all" on weekly_menu_recipes;
create policy "weekly_menu_recipes: member all" on weekly_menu_recipes for all
  using (exists (select 1 from weekly_menus m where m.id = weekly_menu_id and is_household_member(m.household_id)))
  with check (exists (select 1 from weekly_menus m where m.id = weekly_menu_id and is_household_member(m.household_id)));

-- ============================================================
-- OPTIONAL: auto-create a profile row whenever someone signs up.
-- Uncomment and run separately if you want this — not required to
-- test the schema, but saves you inserting profile rows by hand.
-- ============================================================

-- create or replace function handle_new_user()
-- returns trigger
-- language plpgsql
-- security definer
-- as $$
-- begin
--   insert into public.profiles (id, email)
--   values (new.id, new.email);
--   return new;
-- end;
-- $$;
--
-- drop trigger if exists on_auth_user_created on auth.users;
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute procedure handle_new_user();
