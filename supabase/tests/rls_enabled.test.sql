-- Guard: every table in public has Row Level Security switched on,
-- and the anon role (friends) has no direct rights on any table.
begin;
select plan(3);

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

select is(
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
      and p.proname not in ('public_campaign_by_link', 'public_campaign_by_join',
                            'order_status_by_token', 'create_friend_order')),
  '',
  'friends (anon) can only call the four public functions'
);

select * from finish();
rollback;
