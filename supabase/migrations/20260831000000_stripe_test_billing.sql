begin;

alter table public.subscriptions
  add column stripe_event_created_at bigint not null default 0,
  add column stripe_event_id text null;

create index subscriptions_stripe_event_order_idx
  on public.subscriptions (user_id, stripe_event_created_at);

create table public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  stripe_created_at bigint not null,
  processing_status text not null,
  safe_error_code text null,
  processed_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint stripe_webhook_events_status_allowed check (
    processing_status in ('processing', 'succeeded', 'failed', 'ignored')
  ),
  constraint stripe_webhook_events_type_length check (
    char_length(event_type) between 1 and 120
  ),
  constraint stripe_webhook_events_error_length check (
    safe_error_code is null or char_length(safe_error_code) between 1 and 120
  )
);

comment on table public.stripe_webhook_events is
  'Server-only Stripe event receipt ledger. Stores no webhook payload, card data, email, or freight data.';
comment on column public.subscriptions.stripe_event_created_at is
  'Latest applied Stripe event timestamp, used to reject older webhook state.';

create index stripe_webhook_events_status_created_idx
  on public.stripe_webhook_events (processing_status, stripe_created_at);

alter table public.stripe_webhook_events enable row level security;

revoke all on table public.stripe_webhook_events from public, anon, authenticated;
revoke select (stripe_event_created_at, stripe_event_id)
  on public.subscriptions from authenticated;

grant select, insert, update, delete
  on public.stripe_webhook_events to service_role;

-- No anon/authenticated policy is created. Combined with the revoked grants,
-- the event ledger is inaccessible from browser clients even though it lives in
-- the API-exposed public schema for trusted Vercel server access.

commit;
