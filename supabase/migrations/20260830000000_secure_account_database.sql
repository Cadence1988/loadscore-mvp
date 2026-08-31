begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_display_name_length check (
    display_name is null
    or (
      char_length(btrim(display_name)) between 1 and 80
      and display_name = btrim(display_name)
    )
  )
);

comment on table public.user_profiles is
  'LoadScore account metadata only. This is not a truck or freight profile table.';
comment on column public.user_profiles.user_id is
  'Authoritative owner UUID from auth.users; never derived from email.';

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'inactive',
  stripe_customer_id text unique null,
  stripe_subscription_id text unique null,
  current_period_end timestamptz null,
  cancel_at_period_end boolean not null default false,
  grace_period_ends_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_plan_allowed check (
    plan in ('free', 'founding_driver_pro', 'driver_pro')
  ),
  constraint subscriptions_status_allowed check (
    status in (
      'inactive',
      'active',
      'trialing',
      'past_due',
      'unpaid',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'paused'
    )
  )
);

create index subscriptions_user_status_idx
  on public.subscriptions (user_id, status);

comment on table public.subscriptions is
  'Future server-authoritative account tier and billing state. Browser writes are forbidden.';

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function private.set_updated_at();

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function private.set_updated_at();

create function private.bootstrap_loadscore_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.subscriptions (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

comment on function private.bootstrap_loadscore_account() is
  'Creates minimal LoadScore account rows after an auth.users insert. Copies no auth metadata.';

revoke all on function private.bootstrap_loadscore_account() from public, anon, authenticated;

create trigger loadscore_account_after_auth_user_insert
after insert on auth.users
for each row execute function private.bootstrap_loadscore_account();

-- Backfill users who authenticated before this migration. Both statements are
-- intentionally idempotent and preserve any existing account values.
insert into public.user_profiles (user_id)
select users.id
from auth.users as users
on conflict (user_id) do nothing;

insert into public.subscriptions (user_id)
select users.id
from auth.users as users
on conflict (user_id) do nothing;

alter table public.user_profiles enable row level security;
alter table public.subscriptions enable row level security;

revoke all on table public.user_profiles from public, anon, authenticated;
revoke all on table public.subscriptions from public, anon, authenticated;

grant select (user_id, display_name, created_at, updated_at)
  on public.user_profiles to authenticated;
grant update (display_name)
  on public.user_profiles to authenticated;

grant select (
  plan,
  status,
  current_period_end,
  cancel_at_period_end,
  grace_period_ends_at,
  created_at,
  updated_at
) on public.subscriptions to authenticated;

-- The role is a future trusted-server path. No service key is introduced by
-- this migration, and the browser never receives credentials for this role.
grant select, insert, update, delete
  on public.user_profiles, public.subscriptions to service_role;

create policy user_profiles_select_own
on public.user_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy user_profiles_update_own
on public.user_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy subscriptions_select_own
on public.subscriptions
for select
to authenticated
using ((select auth.uid()) = user_id);

commit;
