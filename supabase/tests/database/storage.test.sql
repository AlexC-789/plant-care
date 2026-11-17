begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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

select results_eq($$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'plant-photos' $$,
  $$ values (false, 3145728::bigint, array['image/jpeg']) $$, 'bucket is private, 3 MB, jpeg only');

-- fixture owned by B (as superuser)
insert into storage.objects (bucket_id, name) values
  ('plant-photos', '22222222-2222-2222-2222-222222222222/bbbbbbbb-0000-0000-0000-000000000001.jpg');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select lives_ok($$ insert into storage.objects (bucket_id, name) values
  ('plant-photos', '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001.jpg') $$,
  'A can upload under A/');
select is((select count(*)::int from storage.objects where bucket_id = 'plant-photos'), 1, 'A sees only own photos');
select throws_ok($$ insert into storage.objects (bucket_id, name) values
  ('plant-photos', '22222222-2222-2222-2222-222222222222/aaaaaaaa-0000-0000-0000-000000000002.jpg') $$,
  '42501', null, 'A cannot upload under B/');
select throws_ok($$ insert into storage.objects (bucket_id, name) values
  ('plant-photos', '11111111-1111-1111-1111-111111111111/not-a-uuid.jpg') $$,
  '42501', null, 'name must be {uuid}.jpg');
select throws_ok($$ insert into storage.objects (bucket_id, name) values
  ('plant-photos', '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000003.png') $$,
  '42501', null, 'only .jpg names');
select throws_ok($$ insert into storage.objects (bucket_id, name) values
  ('plant-photos', '11111111-1111-1111-1111-111111111111/x/aaaaaaaa-0000-0000-0000-000000000004.jpg') $$,
  '42501', null, 'no nested folders');

-- storage.protect_delete blocks SQL deletes unless the Storage API flag is set; policies still apply.
set local storage.allow_delete_query = 'true';
delete from storage.objects where name like '22222222%';
select is((select count(*)::int from storage.objects where name like '22222222%'), 0, 'B photo invisible to A');
delete from storage.objects where name like '11111111%';
reset role;
select is((select count(*)::int from storage.objects where name like '22222222%'), 1, 'A cannot delete B''s photo');
select is((select count(*)::int from storage.objects where name like '11111111%'), 0, 'A can delete own photo');

-- anon
set local role anon;
select throws_ok($$ insert into storage.objects (bucket_id, name) values
  ('plant-photos', '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000005.jpg') $$,
  '42501', null, 'anon cannot upload');
select is((select count(*)::int from storage.objects where bucket_id = 'plant-photos'), 0, 'anon sees nothing');
reset role;
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects' and 'anon' = any(roles)), 0, 'no policy targets anon');
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'plant photos%'), 3, 'three plant-photos policies');

select * from finish();
rollback;
