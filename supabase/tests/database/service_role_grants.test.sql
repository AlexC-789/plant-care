begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Edge Functions reach these tables as service_role. Hosted projects don't grant it anything by
-- default (local does), so the grants are explicit and exactly what the functions use.
select table_privs_are('public', 'scans', 'service_role', array['SELECT', 'INSERT'], 'functions read + write scans');
select table_privs_are('public', 'plants', 'service_role', array['SELECT'], 'functions only read plants');
select table_privs_are('public', 'species', 'service_role', array['SELECT', 'INSERT'], 'functions add species, never change them');
select table_privs_are('public', 'search_log', 'service_role', array['SELECT', 'INSERT'], 'functions count + log searches');
select table_privs_are('public', 'plant_photos', 'service_role', array['SELECT', 'INSERT', 'UPDATE'], 'check-health upserts timeline rows');
select table_privs_are('public', 'profiles', 'service_role', array[]::text[], 'functions never touch profiles');

select * from finish();
rollback;
