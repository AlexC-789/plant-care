-- Plant library: shared species reference data, per-user plants, and identify/health scans.
create extension if not exists pg_trgm with schema extensions;

create table public.species (
  id                uuid primary key default gen_random_uuid(),
  scientific_name   text not null unique,
  common_names      text[] not null default '{}',
  description       text,
  light             text check (light in ('bright_indirect', 'medium', 'low', 'direct')),
  watering          text,
  moisture_category text check (moisture_category in ('dry', 'moderate', 'moist')),
  origin            text not null check (origin in ('curated', 'plantid')),
  checked_against   text,
  plantid_name      text,
  updated_at        timestamptz not null default now()
);

-- One lowercase string of all names so a single trigram index serves ILIKE search
-- (the app filters `search_text`).
-- shortcut: array_to_string is only stable, but is safe here; upgrade if names ever depend on locale settings.
create function public.species_search_text(scientific_name text, common_names text[])
returns text
language sql
immutable
set search_path = ''
as $$ select lower(scientific_name || ' ' || coalesce(array_to_string(common_names, ' '), '')) $$;

revoke execute on function public.species_search_text(text, text[]) from public, anon, authenticated;

alter table public.species
  add column search_text text generated always as (public.species_search_text(scientific_name, common_names)) stored;

create index species_search_text_trgm on public.species using gin (search_text extensions.gin_trgm_ops);

create table public.plants (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  species_id   uuid references public.species (id),
  custom_type  text,
  room         text check (char_length(room) <= 40),
  photo_path   text,
  setup_step   smallint not null default 1,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index plants_user_created on public.plants (user_id, created_at desc);

create table public.scans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plant_id     uuid references public.plants (id) on delete cascade,
  kind         text not null check (kind in ('identify', 'health')),
  photo_paths  text[] not null default '{}',
  status       text not null check (status in ('ok', 'not_plant', 'error')),
  is_plant     numeric,
  suggestions  jsonb,
  health       jsonb,
  created_at   timestamptz not null default now()
);
create index scans_user_created on public.scans (user_id, created_at desc);
create index scans_plant on public.scans (plant_id);

alter table public.species enable row level security;
alter table public.plants enable row level security;
alter table public.scans enable row level security;

create policy species_select on public.species
  for select to authenticated using (true);

create policy plants_select_own on public.plants
  for select to authenticated using (user_id = (select auth.uid()));
create policy plants_insert_own on public.plants
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy plants_update_own on public.plants
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy plants_delete_own on public.plants
  for delete to authenticated using (user_id = (select auth.uid()));

create policy scans_select_own on public.scans
  for select to authenticated using (user_id = (select auth.uid()));
-- Link once: only an unlinked own scan, and only to an own plant.
create policy scans_link_own on public.scans
  for update to authenticated
  using (user_id = (select auth.uid()) and plant_id is null)
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.plants p where p.id = plant_id and p.user_id = (select auth.uid()))
  );

revoke all on public.species, public.plants, public.scans from anon, authenticated;
grant select on public.species to authenticated;
grant select, delete on public.plants to authenticated;
grant insert (name, species_id, custom_type, room, photo_path, setup_step) on public.plants to authenticated;
grant update (name, species_id, custom_type, room, photo_path, setup_step) on public.plants to authenticated;
grant select on public.scans to authenticated;
grant update (plant_id) on public.scans to authenticated;

create trigger species_set_updated_at
  before update on public.species
  for each row execute function public.set_updated_at();
create trigger plants_set_updated_at
  before update on public.plants
  for each row execute function public.set_updated_at();
