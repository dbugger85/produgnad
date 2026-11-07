-- Guard: every table in public has Row Level Security switched on,
-- and the anon role (friends) has no direct rights on any table.
begin;
select plan(2);

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'all public tables have RLS enabled'
);

select is(
  (select count(*)::int from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public'),
  0,
  'anon has no direct table rights'
);

select * from finish();
rollback;
