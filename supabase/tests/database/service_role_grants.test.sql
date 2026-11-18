begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Edge Functions reach these tables as service_role. Hosted projects don't grant it anything by
-- default (local does), so the grants are explicit and exactly what the functions use.
select table_privs_are('public', 'scans', 'service_role', array['SELECT', 'INSERT'], 'functions read + write scans');
select table_privs_are('public', 'plants', 'service_role', array['SELECT'], 'functions only read plants');
select table_privs_are('public', 'species', 'service_role', array['SELECT', 'INSERT'], 'functions add species, never change them');
select table_privs_are('public', 'search_log', 'service_role', array['SELECT', 'INSERT'], 'functions count + log searches');
select table_privs_are('public', 'plant_photos', 'service_role', array['SELECT', 'INSERT', 'UPDATE'], 'check-health upserts timeline rows');
select table_privs_are('public', 'profiles', 'service_role', array[]::text[], 'functions never touch profiles');
select ok(has_function_privilege('service_role', 'public.species_search_text(text, text[])', 'execute'), 'species inserts compute search_text (generated column)');
select table_privs_are('public', 'devices', 'service_role', array['SELECT', 'UPDATE'], 'functions read devices and record syncs');
select table_privs_are('public', 'readings', 'service_role', array['SELECT', 'INSERT'], 'functions append readings');
select table_privs_are('public', 'device_events', 'service_role', array['SELECT', 'INSERT'], 'functions append events');
select table_privs_are('public', 'device_commands', 'service_role', array['SELECT', 'UPDATE'], 'functions deliver and ack commands');
select table_privs_are('public', 'device_claims', 'service_role', array[]::text[], 'functions claim only through claim_device');
select ok(has_function_privilege('service_role', 'public.claim_device(text, text, text)', 'execute'), 'service_role can claim devices');

select * from finish();
rollback;
