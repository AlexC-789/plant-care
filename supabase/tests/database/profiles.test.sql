begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- helpers ---------------------------------------------------------------
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

-- schema ------------------------------------------------------------------
select has_table('public', 'profiles', 'profiles table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true, 'RLS is enabled on profiles');

-- signup trigger ----------------------------------------------------------
select is(
  (select count(*)::int from public.profiles where user_id = '11111111-1111-1111-1111-111111111111'),
  1, 'signup creates exactly one profile');
select results_eq(
  $$ select units, subscription_status from public.profiles where user_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('metric'::text, 'none'::text) $$,
  'new profile defaults to metric units and no subscription');

-- as user A ---------------------------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select is((select count(*)::int from public.profiles), 1, 'user sees only their own profile');

select lives_ok(
  $$ update public.profiles set display_name = 'A' where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'user can update own display name');
select is(
  (select display_name from public.profiles where user_id = '11111111-1111-1111-1111-111111111111'),
  'A', 'own display name changed');

update public.profiles set display_name = 'hacked' where user_id = '22222222-2222-2222-2222-222222222222';

select throws_ok(
  $$ update public.profiles set subscription_status = 'active' $$,
  '42501', null, 'user cannot change subscription_status');
select throws_ok(
  $$ insert into public.profiles (user_id) values (gen_random_uuid()) $$,
  '42501', null, 'user cannot insert profiles');
select throws_ok(
  $$ delete from public.profiles $$,
  '42501', null, 'user cannot delete profiles');
select throws_ok(
  $$ update public.profiles set units = 'furlongs' $$,
  '23514', null, 'units must be metric or imperial');

reset role;
select is(
  (select display_name from public.profiles where user_id = '22222222-2222-2222-2222-222222222222'),
  null, 'user A could not change user B''s profile');

-- anon --------------------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
reset role;

select * from finish();
rollback;
