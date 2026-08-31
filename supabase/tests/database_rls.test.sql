begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_profiles'::regclass),
  'RLS is enabled on public.user_profiles'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.subscriptions'::regclass),
  'RLS is enabled on public.subscriptions'
);

select ok(
  not has_table_privilege('anon', 'public.user_profiles', 'select'),
  'anon has no profile select grant'
);
select ok(
  not has_table_privilege('anon', 'public.subscriptions', 'select'),
  'anon has no subscription select grant'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'alpha@example.test', '',
    now(), now(), now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'beta@example.test', '',
    now(), now(), now()
  );

update public.user_profiles
set display_name = case
  when user_id = '10000000-0000-0000-0000-000000000001' then 'Alpha Driver'
  else 'Beta Driver'
end;

update public.subscriptions
set current_period_end = timestamptz '2099-01-01 00:00:00+00'
where user_id = '10000000-0000-0000-0000-000000000001';

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select display_name from public.user_profiles order by display_name $$,
  $$ values ('Alpha Driver'::text) $$,
  'user A can select only their own profile'
);
select is_empty(
  $$ select display_name from public.user_profiles where display_name = 'Beta Driver' $$,
  'user A cannot select user B profile'
);
select results_eq(
  $$
    update public.user_profiles
    set display_name = 'Alpha Updated'
    where user_id = '10000000-0000-0000-0000-000000000001'
    returning display_name
  $$,
  $$ values ('Alpha Updated'::text) $$,
  'user A can update their own allowed display_name'
);
select is_empty(
  $$
    update public.user_profiles
    set display_name = 'Forbidden'
    where user_id = '20000000-0000-0000-0000-000000000002'
    returning display_name
  $$,
  'user A cannot update user B profile'
);
select ok(
  not has_column_privilege('authenticated', 'public.user_profiles', 'user_id', 'update'),
  'authenticated users cannot reassign profile ownership'
);
select ok(
  not has_column_privilege('authenticated', 'public.user_profiles', 'created_at', 'update'),
  'authenticated users cannot update profile system timestamps'
);
select ok(
  not has_table_privilege('authenticated', 'public.user_profiles', 'insert'),
  'authenticated users cannot insert profiles'
);
select ok(
  not has_table_privilege('authenticated', 'public.user_profiles', 'delete'),
  'authenticated users cannot delete profiles'
);
select results_eq(
  $$ select plan, status from public.subscriptions $$,
  $$ values ('free'::text, 'inactive'::text) $$,
  'user A can read only their own safe subscription state'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is_empty(
  $$
    select plan
    from public.subscriptions
    where current_period_end = timestamptz '2099-01-01 00:00:00+00'
  $$,
  'user B cannot see user A subscription markers'
);
select ok(
  not has_table_privilege('authenticated', 'public.subscriptions', 'insert'),
  'authenticated browser cannot create subscriptions'
);
select ok(
  not has_table_privilege('authenticated', 'public.subscriptions', 'update'),
  'authenticated browser cannot update plan or status'
);
select ok(
  not has_table_privilege('authenticated', 'public.subscriptions', 'delete'),
  'authenticated browser cannot delete subscriptions'
);
select ok(
  not has_column_privilege('authenticated', 'public.subscriptions', 'stripe_customer_id', 'select'),
  'authenticated browser cannot read Stripe customer identifiers'
);

reset role;

select is(
  (select count(*) from public.user_profiles where user_id = '10000000-0000-0000-0000-000000000001'),
  1::bigint,
  'existing auth user has exactly one profile'
);
select is(
  (select count(*) from public.subscriptions where user_id = '10000000-0000-0000-0000-000000000001'),
  1::bigint,
  'existing auth user has exactly one subscription foundation row'
);

insert into public.user_profiles (user_id)
values ('10000000-0000-0000-0000-000000000001')
on conflict (user_id) do nothing;
insert into public.subscriptions (user_id)
values ('10000000-0000-0000-0000-000000000001')
on conflict (user_id) do nothing;

select is(
  (select count(*) from public.user_profiles where user_id = '10000000-0000-0000-0000-000000000001'),
  1::bigint,
  'repeated profile bootstrap cannot create a duplicate'
);
select is(
  (select count(*) from public.subscriptions where user_id = '10000000-0000-0000-0000-000000000001'),
  1::bigint,
  'repeated subscription bootstrap cannot create a duplicate'
);
select is(
  (select plan || '/' || status from public.subscriptions where user_id = '10000000-0000-0000-0000-000000000001'),
  'free/inactive'::text,
  'bootstrap never self-grants paid state'
);

delete from auth.users
where id = '20000000-0000-0000-0000-000000000002';

select is(
  (select count(*) from public.user_profiles where user_id = '20000000-0000-0000-0000-000000000002'),
  0::bigint,
  'auth-user deletion cascades to profile'
);
select is(
  (select count(*) from public.subscriptions where user_id = '20000000-0000-0000-0000-000000000002'),
  0::bigint,
  'auth-user deletion cascades to subscription foundation'
);

select * from finish();
rollback;
