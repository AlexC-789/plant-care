begin;
create extension if not exists pgtap with schema extensions;
select plan(50);

create function pg_temp.new_user(uid uuid, mail text) returns void language sql as $$
  insert into auth.users (id, email, aud, role, instance_id)
  values (uid, mail, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
$$;
create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.new_user('11111111-1111-1111-1111-111111111111', 'a@example.com');
select pg_temp.new_user('22222222-2222-2222-2222-222222222222', 'b@example.com');

-- fixtures (as superuser): plants A1, A2, A3 (A) and B1 (B)
insert into public.plants (id, user_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'A1'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'A2'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'A3'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'B1');
insert into public.devices (id, user_id, plant_id, secret_hash) values
  ('dddddddd-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'hashA'),
  ('dddddddd-0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000001', 'hashB');
insert into public.readings (device_id, ts, soil_raw, tank_raw, float_low, battery_mv, charging) values
  ('dddddddd-0000-0000-0000-00000000000a', now(), 2000, 2000, false, 3900, false),
  ('dddddddd-0000-0000-0000-00000000000b', now(), 2000, 2000, false, 3900, false);
insert into public.device_events (device_id, ts, type) values
  ('dddddddd-0000-0000-0000-00000000000a', now(), 'boot'),
  ('dddddddd-0000-0000-0000-00000000000b', now(), 'boot');
insert into public.device_commands (device_id, type) values
  ('dddddddd-0000-0000-0000-00000000000a', 'clear_fault'),
  ('dddddddd-0000-0000-0000-00000000000b', 'clear_fault');
insert into public.device_claims (code, user_id, plant_id) values
  ('FIXTUREA123', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000003'),
  ('FIXTUREB123', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000001');

select is((select relrowsecurity from pg_class where oid = 'public.devices'::regclass), true, 'RLS on devices');
select is((select relrowsecurity from pg_class where oid = 'public.readings'::regclass), true, 'RLS on readings');
select is((select relrowsecurity from pg_class where oid = 'public.device_events'::regclass), true, 'RLS on device_events');
select is((select relrowsecurity from pg_class where oid = 'public.device_commands'::regclass), true, 'RLS on device_commands');
select is((select relrowsecurity from pg_class where oid = 'public.device_claims'::regclass), true, 'RLS on device_claims');

-- as user A
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select is((select count(*)::int from public.devices), 1, 'A sees only own devices');
select is((select count(*)::int from public.readings), 1, 'A sees only own readings');
select is((select count(*)::int from public.device_events), 1, 'A sees only own events');
select is((select count(*)::int from public.device_commands), 1, 'A sees only own commands');
select is((select count(*)::int from public.device_claims), 1, 'A sees only own claims');

select throws_ok($$ select secret_hash from public.devices $$, '42501', null, 'secret_hash is not readable');
select lives_ok($$ select id, soil_pct, soil_air_raw from public.devices $$, 'other device columns are readable');

select throws_ok($$ insert into public.devices (user_id, plant_id, secret_hash) values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002', 'x') $$, '42501', null, 'A cannot insert devices');
select throws_ok($$ insert into public.readings (device_id, ts, soil_raw, tank_raw, float_low, battery_mv, charging) values ('dddddddd-0000-0000-0000-00000000000a', now(), 1, 1, false, 1, false) $$, '42501', null, 'A cannot insert readings');
select throws_ok($$ insert into public.device_events (device_id, ts, type) values ('dddddddd-0000-0000-0000-00000000000a', now(), 'boot') $$, '42501', null, 'A cannot insert events');
select throws_ok($$ update public.devices set soil_pct = 1 $$, '42501', null, 'A cannot update devices');
select throws_ok($$ update public.device_commands set acked_at = now() $$, '42501', null, 'A cannot update commands');

select lives_ok($$ insert into public.device_claims (plant_id) values ('aaaaaaaa-0000-0000-0000-000000000002') $$, 'A can claim own plant');
select matches((select code from public.device_claims where plant_id = 'aaaaaaaa-0000-0000-0000-000000000002'), '^[2-9A-HJKMNP-Z]{12}$', 'claim code has 12 safe chars');
select ok((select expires_at between now() + interval '14 minutes' and now() + interval '16 minutes' from public.device_claims where plant_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 'claim expires in about 15 minutes');
insert into public.device_claims (plant_id) values ('aaaaaaaa-0000-0000-0000-000000000002');
select is((select count(*)::int from public.device_claims where plant_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 1, 'a new claim replaces the old one');

select throws_ok($$ insert into public.device_claims (plant_id) values ('bbbbbbbb-0000-0000-0000-000000000001') $$, '42501', null, 'A cannot claim another user''s plant');
select throws_ok($$ insert into public.device_claims (plant_id) values ('aaaaaaaa-0000-0000-0000-000000000001') $$, '42501', null, 'A cannot claim a plant that has a module');

select lives_ok($$ insert into public.device_commands (device_id, type) values ('dddddddd-0000-0000-0000-00000000000a', 'clear_fault') $$, 'A can queue clear_fault for own device');
select throws_ok($$ insert into public.device_commands (device_id, type) values ('dddddddd-0000-0000-0000-00000000000b', 'clear_fault') $$, '42501', null, 'A cannot command another user''s device');
select throws_ok($$ insert into public.device_commands (device_id, type) values ('dddddddd-0000-0000-0000-00000000000a', 'unpair') $$, '23514', null, 'unknown command type rejected');

select throws_ok($$ select public.claim_device('X', 'h', 'v') $$, '42501', null, 'A cannot call claim_device');

select throws_ok($$ insert into public.device_claims (plant_id, code) values ('aaaaaaaa-0000-0000-0000-000000000002', 'AAAAAAAAAAAA') $$, '42501', null, 'A cannot choose a claim code');
select throws_ok($$ insert into public.device_claims (plant_id, expires_at) values ('aaaaaaaa-0000-0000-0000-000000000002', now() + interval '1 year') $$, '42501', null, 'A cannot choose a claim expiry');
select throws_ok($$ insert into public.device_commands (device_id, type, acked_at) values ('dddddddd-0000-0000-0000-00000000000a', 'clear_fault', now()) $$, '42501', null, 'A cannot pre-ack a command');
select ok(has_function_privilege('authenticated', 'public.new_claim_code()', 'execute'), 'authenticated can execute new_claim_code');
select is_empty($$ with d as (delete from public.devices where id = 'dddddddd-0000-0000-0000-00000000000b' returning 1) select * from d $$, 'A deletes none of B''s devices');

select lives_ok($$ delete from public.devices where id = 'dddddddd-0000-0000-0000-00000000000a' $$, 'A can delete own device');
reset role;
select is((select count(*)::int from public.devices where id = 'dddddddd-0000-0000-0000-00000000000b'), 1, 'B''s device is still there');
select is((select count(*)::int from public.readings where device_id = 'dddddddd-0000-0000-0000-00000000000a'), 0, 'readings cascade');
select is((select count(*)::int from public.device_events where device_id = 'dddddddd-0000-0000-0000-00000000000a'), 0, 'events cascade');
select is((select count(*)::int from public.device_commands where device_id = 'dddddddd-0000-0000-0000-00000000000a'), 0, 'commands cascade');
select is((select count(*)::int from public.devices where id = 'dddddddd-0000-0000-0000-00000000000b'), 1, 'B''s device untouched');

-- service_role: idempotent uploads need SELECT on the conflict target
set local role service_role;
select lives_ok($$ insert into public.readings (device_id, ts, soil_raw, tank_raw, float_low, battery_mv, charging) select device_id, ts, 1, 1, false, 1, false from public.readings where device_id = 'dddddddd-0000-0000-0000-00000000000b' on conflict (device_id, ts) do nothing $$, 'service_role can upsert a duplicate reading');
select is((select count(*)::int from public.readings where device_id = 'dddddddd-0000-0000-0000-00000000000b'), 1, 'duplicate reading leaves the count unchanged');
select lives_ok($$ insert into public.device_events (device_id, ts, type, code) values ('dddddddd-0000-0000-0000-00000000000b', '2026-01-01T00:00:00Z', 'fault', 'no_moisture_rise'), ('dddddddd-0000-0000-0000-00000000000b', '2026-01-01T00:00:00Z', 'fault', 'sensor_out_of_range') $$, 'two faults in one wake with different codes are both kept');
insert into public.device_events (device_id, ts, type) values ('dddddddd-0000-0000-0000-00000000000b', '2026-01-02T00:00:00Z', 'fault');
select throws_ok($$ insert into public.device_events (device_id, ts, type) values ('dddddddd-0000-0000-0000-00000000000b', '2026-01-02T00:00:00Z', 'fault') $$, '23505', null, 'exact duplicate event (null codes) conflicts');
reset role;

-- claim_device (superuser stands in for service_role)
create temp table res as
  select public.claim_device((select code from public.device_claims where plant_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 'hash1', 'sim') as r;
select ok((select (r->>'device_id')::uuid is not null from res), 'claim_device returns device_id');
select is((select count(*)::int from public.device_claims where plant_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 0, 'claim is consumed');
select is((select last_seen_at is not null and firmware_version = 'sim' from public.devices where plant_id = 'aaaaaaaa-0000-0000-0000-000000000002'), true, 'new device has last_seen_at and firmware');
select is(public.claim_device('NOSUCHCODE12', 'hash2', 'sim'), '{"error":"not_found"}'::jsonb, 'unknown code is not_found');
update public.device_claims set expires_at = now() - interval '1 minute' where code = 'FIXTUREA123';
select is(public.claim_device('FIXTUREA123', 'hash3', 'sim'), '{"error":"not_found"}'::jsonb, 'expired code is not_found');
insert into public.device_claims (code, user_id, plant_id) values ('HASMODULE001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000003');
insert into public.devices (user_id, plant_id, secret_hash) values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000003', 'hash4');
select is(public.claim_device('HASMODULE001', 'hash5', 'sim'), '{"error":"has_module"}'::jsonb, 'plant that gained a module is has_module');

insert into public.readings (device_id, ts, soil_raw, tank_raw, float_low, battery_mv, charging)
  select id, now(), 1, 1, false, 1, false from public.devices where plant_id = 'aaaaaaaa-0000-0000-0000-000000000002';
delete from public.plants where id = 'aaaaaaaa-0000-0000-0000-000000000002';
select is((select count(*)::int from public.devices where plant_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 0, 'deleting the plant removes its device');
select is((select count(*)::int from public.readings r where not exists (select 1 from public.devices d where d.id = r.device_id)), 0, 'and its readings');

select * from finish();
rollback;
