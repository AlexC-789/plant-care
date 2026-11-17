begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, aud, role, instance_id)
  values ('11111111-1111-1111-1111-111111111111', 'a@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
insert into public.search_log (user_id) values ('11111111-1111-1111-1111-111111111111');

select ok((select relrowsecurity from pg_class where oid = 'public.search_log'::regclass), 'RLS is on');
select is((select count(*)::int from pg_policies where tablename = 'search_log'), 0, 'no policies');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from public.search_log$$, '42501', null, 'authenticated cannot read');
select throws_ok($$insert into public.search_log (user_id) values ('11111111-1111-1111-1111-111111111111')$$, '42501', null, 'authenticated cannot insert');

select * from finish();
rollback;
