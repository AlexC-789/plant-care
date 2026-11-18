begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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

-- A's plant with three photos (main = newest = a3), B's plant with one
insert into public.plants (id, user_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'A fern'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'B fern');
insert into public.plant_photos (id, user_id, plant_id, path, taken_at) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-0000000000a1.jpg', '2026-01-01'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-0000000000a2.jpg', '2026-02-01'),
  ('aaaaaaaa-0000-0000-0000-0000000000f3', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-0000000000a3.jpg', '2026-03-01'),
  ('bbbbbbbb-0000-0000-0000-0000000000f1', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222/00000000-0000-0000-0000-0000000000b1.jpg', '2026-01-01');
update public.plants set photo_path = '11111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-0000000000a3.jpg'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.plants set photo_path = '22222222-2222-2222-2222-222222222222/00000000-0000-0000-0000-0000000000b1.jpg'
  where id = 'bbbbbbbb-0000-0000-0000-000000000001';

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select is(public.delete_plant_photo('aaaaaaaa-0000-0000-0000-0000000000f1'),
  '11111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-0000000000a1.jpg', 'returns the deleted path');
select is((select photo_path from public.plants where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-0000000000a3.jpg', 'an older photo leaves the main photo alone');
select public.delete_plant_photo('aaaaaaaa-0000-0000-0000-0000000000f3');
select is((select photo_path from public.plants where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-0000000000a2.jpg', 'deleting the main photo promotes the next newest');
select public.delete_plant_photo('aaaaaaaa-0000-0000-0000-0000000000f2');
select is((select photo_path from public.plants where id = 'aaaaaaaa-0000-0000-0000-000000000001'), null, 'deleting the only photo clears the main photo');
select is((select count(*)::int from public.plant_photos), 0, 'A''s timeline is empty');
select is(public.delete_plant_photo('aaaaaaaa-0000-0000-0000-0000000000f2'), null, 'an already deleted photo returns null');
select is(public.delete_plant_photo('bbbbbbbb-0000-0000-0000-0000000000f1'), null, 'A cannot delete B''s photo');

reset role;
select is((select photo_path from public.plants where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  '22222222-2222-2222-2222-222222222222/00000000-0000-0000-0000-0000000000b1.jpg', 'B''s photo and main photo are untouched');

select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select public.delete_plant_photo('bbbbbbbb-0000-0000-0000-0000000000f1') $$, '42501', null, 'anon cannot call it');

select * from finish();
rollback;
