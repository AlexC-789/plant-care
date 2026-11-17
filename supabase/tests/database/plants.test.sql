begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

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
insert into public.species (id, scientific_name, common_names, origin)
  values ('00000000-0000-0000-0000-0000000000a1', 'Monstera deliciosa', '{Swiss cheese plant}', 'curated');
insert into public.plants (id, user_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'A fern'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'B fern');
insert into public.scans (id, user_id, kind, status) values
  ('aaaaaaaa-0000-0000-0000-000000000051', '11111111-1111-1111-1111-111111111111', 'identify', 'ok'),
  ('aaaaaaaa-0000-0000-0000-000000000052', '11111111-1111-1111-1111-111111111111', 'identify', 'ok'),
  ('bbbbbbbb-0000-0000-0000-000000000051', '22222222-2222-2222-2222-222222222222', 'identify', 'ok');

select is((select count(*)::int from pg_class where oid in
  ('public.species'::regclass, 'public.plants'::regclass, 'public.scans'::regclass) and relrowsecurity),
  3, 'RLS is enabled on species, plants and scans');

-- as user A
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select is((select count(*)::int from public.plants), 1, 'A sees only own plants');
select is((select count(*)::int from public.scans), 2, 'A sees only own scans');
select is((select count(*)::int from public.species), 1, 'A can read species');
select cmp_ok(
  (select count(*)::int from public.species where search_text ilike '%swiss%'),
  '=', 1, 'species names are searchable with ILIKE');

select lives_ok($$ insert into public.plants (name, room) values ('Fern', 'Kitchen') $$, 'A can insert own plant');
select is((select user_id from public.plants where name = 'Fern'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'user_id defaults to the caller');
select lives_ok($$ update public.plants set name = 'Fern 2' where name = 'Fern' $$, 'A can update own plant');
select throws_ok($$ insert into public.plants (name) values ('') $$, '23514', null, 'name cannot be empty');
select throws_ok($$ insert into public.plants (name) values (repeat('x', 61)) $$, '23514', null, 'name is at most 60 chars');
select throws_ok($$ insert into public.plants (name, room) values ('x', repeat('r', 41)) $$, '23514', null, 'room is at most 40 chars');
select throws_ok($$ insert into public.plants (user_id, name) values ('22222222-2222-2222-2222-222222222222', 'x') $$,
  '42501', null, 'A cannot insert a plant for B');

update public.plants set name = 'hacked' where id = 'bbbbbbbb-0000-0000-0000-000000000001';
delete from public.plants where id = 'bbbbbbbb-0000-0000-0000-000000000001';

select throws_ok($$ insert into public.species (scientific_name, origin) values ('X y', 'curated') $$,
  '42501', null, 'users cannot insert species');
select throws_ok($$ update public.species set description = 'x' $$, '42501', null, 'users cannot update species');
select throws_ok($$ delete from public.species $$, '42501', null, 'users cannot delete species');
select throws_ok($$ insert into public.scans (kind, status) values ('identify', 'ok') $$,
  '42501', null, 'users cannot insert scans');
select throws_ok($$ update public.scans set status = 'error' $$, '42501', null, 'users cannot update other scan columns');

-- linking
select lives_ok($$ update public.scans set plant_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  where id = 'aaaaaaaa-0000-0000-0000-000000000051' $$, 'A can link own scan to own plant');
update public.scans set plant_id = 'aaaaaaaa-0000-0000-0000-000000000001' where id = 'aaaaaaaa-0000-0000-0000-000000000051';
select throws_ok($$ update public.scans set plant_id = 'bbbbbbbb-0000-0000-0000-000000000001'
  where id = 'aaaaaaaa-0000-0000-0000-000000000052' $$, '42501', null, 'A cannot link a scan to B''s plant');

update public.scans set plant_id = 'aaaaaaaa-0000-0000-0000-000000000001' where id = 'bbbbbbbb-0000-0000-0000-000000000051';
select throws_ok($$ delete from public.scans $$, '42501', null, 'users cannot delete scans');
select throws_ok($$ update public.plants set user_id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null, 'users cannot reassign a plant''s owner');

reset role;
select is((select plant_id from public.scans where id = 'bbbbbbbb-0000-0000-0000-000000000051'), null,
  'A could not link B''s scan');
select is((select plant_id from public.scans where id = 'aaaaaaaa-0000-0000-0000-000000000051'),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'link was stored');
select is((select name from public.plants where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  'B fern', 'A could not change or delete B''s plant');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
update public.scans set plant_id = (select id from public.plants where name = 'Fern 2')
  where id = 'aaaaaaaa-0000-0000-0000-000000000051';
reset role;
select is((select plant_id from public.scans where id = 'aaaaaaaa-0000-0000-0000-000000000051'),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'a linked scan cannot be re-linked');

-- cascade, deleting as the owner
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
delete from public.plants where id = 'aaaaaaaa-0000-0000-0000-000000000001';
reset role;
select is((select count(*)::int from public.scans where id = 'aaaaaaaa-0000-0000-0000-000000000051'),
  0, 'deleting a plant deletes its scans');

-- anon
set local role anon;
select throws_ok($$ select * from public.plants $$, '42501', null, 'anon cannot read plants');
select throws_ok($$ select * from public.scans $$, '42501', null, 'anon cannot read scans');
select throws_ok($$ select * from public.species $$, '42501', null, 'anon cannot read species');
reset role;

select * from finish();
rollback;
