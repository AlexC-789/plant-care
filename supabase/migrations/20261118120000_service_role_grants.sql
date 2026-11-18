-- Edge Functions reach the database as service_role through PostgREST. Hosted projects don't give
-- service_role any table privileges by default (local does), so every function call failed with
-- 42501 there. Grant exactly what the functions use, the same everywhere; RLS is bypassed by the role.
-- A new table a function needs must be added here (tests/database/service_role_grants.test.sql).
revoke all on public.scans, public.plants, public.species, public.search_log, public.plant_photos, public.profiles
  from service_role;
grant select, insert on public.scans to service_role;
grant select on public.plants to service_role;
grant select, insert on public.species to service_role;
grant select, insert on public.search_log to service_role;
grant select, insert, update on public.plant_photos to service_role;
