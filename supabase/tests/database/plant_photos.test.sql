begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

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

-- fixtures (as superuser)
insert into public.plants (id, user_id, name, photo_path, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'A fern',
   '11111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-0000000000a1.jpg', '2026-01-01T10:00:00Z'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'B fern', null, now());
insert into public.scans (id, user_id, plant_id, kind, status, photo_paths, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000051', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'health', 'ok',
   '{11111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-0000000000a2.jpg}', '2026-02-02T10:00:00Z'),
  ('aaaaaaaa-0000-0000-0000-000000000052', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'identify', 'ok',
   -- also holds a1, as the add flow's identify scan does: one path in two scans of the same plant
   '{11111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-0000000000a3.jpg,11111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-0000000000a1.jpg}', '2026-03-03T10:00:00Z'),
  ('aaaaaaaa-0000-0000-0000-000000000053', '11111111-1111-1111-1111-111111111111', null, 'identify', 'ok',
   '{11111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-0000000000a4.jpg}', now()),
  -- add-flow health check: its photo is also the plant's main photo
  ('aaaaaaaa-0000-0000-0000-000000000054', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'health', 'ok',
   '{11111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-0000000000a1.jpg}', '2026-01-01T10:05:00Z'),
  -- a later health check of the same photo: the earliest check keeps the row
  ('aaaaaaaa-0000-0000-0000-000000000055', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'health', 'ok',
   '{11111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-0000000000a2.jpg}', '2026-04-04T10:00:00Z');
-- the plant insert above ran the trigger; clear so the backfill is tested from scratch.
-- Superuser assertions are scoped to the fixture plant: a local DB may hold other users' data.
delete from public.plant_photos;

select is((select relrowsecurity from pg_class where oid = 'public.plant_photos'::regclass), true, 'RLS is enabled on plant_photos');

-- backfill (superuser)
select public.backfill_plant_photos();
select is((select count(*)::int from public.plant_photos where plant_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 3, 'backfill: plant photo + 2 linked scan photos, unlinked scan skipped');
select is((select taken_at from public.plant_photos where plant_id = 'aaaaaaaa-0000-0000-0000-000000000001' and path like '%a1.jpg'), '2026-01-01T10:00:00Z'::timestamptz, 'backfill: plant photo taken_at = plant created_at');
select is((select taken_at from public.plant_photos where plant_id = 'aaaaaaaa-0000-0000-0000-000000000001' and path like '%a2.jpg'), '2026-02-02T10:00:00Z'::timestamptz, 'backfill: scan photo taken_at = scan created_at');
select is((select scan_id from public.plant_photos where plant_id = 'aaaaaaaa-0000-0000-0000-000000000001' and path like '%a2.jpg'), 'aaaaaaaa-0000-0000-0000-000000000051'::uuid, 'backfill: health scan sets scan_id');
select is((select scan_id from public.plant_photos where plant_id = 'aaaaaaaa-0000-0000-0000-000000000001' and path like '%a3.jpg'), null, 'backfill: identify scan leaves scan_id null');
select is((select scan_id from public.plant_photos where plant_id = 'aaaaaaaa-0000-0000-0000-000000000001' and path like '%a1.jpg'), 'aaaaaaaa-0000-0000-0000-000000000054'::uuid, 'backfill: main photo keeps its health scan_id');
select lives_ok($$ select public.backfill_plant_photos() $$, 'backfill is idempotent');
select is((select count(*)::int from public.plant_photos where plant_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 3, 'backfill: no duplicates on re-run');

insert into public.plant_photos (user_id, plant_id, path) values
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222/00000000-0000-0000-0000-0000000000b1.jpg');

-- as user A
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select is((select count(*)::int from public.plant_photos), 3, 'A sees only own rows');
select lives_ok($$ insert into public.plant_photos (plant_id, path) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-0000000000a5.jpg') $$,
  'A can insert a photo for own plant');
select throws_ok($$ insert into public.plant_photos (plant_id, path) values ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-0000000000a6.jpg') $$,
  '42501', null, 'A cannot insert for B''s plant');
select throws_ok($$ insert into public.plant_photos (plant_id, path) values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222/00000000-0000-0000-0000-0000000000a7.jpg') $$,
  '23514', null, 'A cannot use a path under B''s folder');
select throws_ok($$ insert into public.plant_photos (plant_id, path, scan_id) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-0000000000a8.jpg', 'aaaaaaaa-0000-0000-0000-000000000051') $$,
  '42501', null, 'A cannot set scan_id');
select throws_ok($$ insert into public.plant_photos (user_id, plant_id, path) values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222/00000000-0000-0000-0000-0000000000a9.jpg') $$,
  '42501', null, 'A cannot set user_id');
select throws_ok($$ update public.plant_photos set taken_at = now() $$, '42501', null, 'A cannot update');
select throws_ok($$ select public.backfill_plant_photos() $$, '42501', null, 'A cannot run the backfill');

delete from public.plant_photos where path like '%b1.jpg';
select is((select count(*)::int from public.plant_photos), 4, 'A delete of B''s row is a no-op');
delete from public.plant_photos where plant_id = 'aaaaaaaa-0000-0000-0000-000000000001' and path like '%a5.jpg';
select is((select count(*)::int from public.plant_photos), 3, 'A can delete own row');

-- as anon
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select count(*) from public.plant_photos $$, '42501', null, 'anon has no access');

-- trigger + cascade (superuser)
reset role;
select is((select count(*)::int from public.plant_photos where path like '%b1.jpg'), 1, 'A''s delete left B''s row in place');
update public.plants set photo_path = '11111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-0000000000c1.jpg'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.plants set photo_path = '11111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-0000000000c1.jpg', name = 'again'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select count(*)::int from public.plant_photos where path like '%c1.jpg'), 1, 'photo_path update adds one timeline row, no duplicate');

delete from public.plants where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select count(*)::int from public.plant_photos where plant_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'deleting a plant cascades its photo rows');

select * from finish();
rollback;
