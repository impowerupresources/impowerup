-- ImpowerUp push notifications schema
-- Run this once in Supabase: Dashboard -> SQL Editor -> paste -> Run

create table if not exists push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table if not exists scheduled_alerts (
  id text primary key,                                  -- reuse the reminder's id from the app
  subscription_endpoint text not null references push_subscriptions(endpoint) on delete cascade,
  title text not null,
  body text default '',
  days text[] not null default '{}',                     -- e.g. {Mon,Tue,Wed}
  time_of_day text not null,                              -- 'HH:MM', device local time
  next_fire_at timestamptz,                               -- UTC instant of the next occurrence; the app recalculates this every time it syncs
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
alter table scheduled_alerts enable row level security;

-- No login system in this app, so access is scoped only by knowing the
-- anon key (same trust model as the app's local-only design). Anyone with
-- the anon key could read/write these two small tables -- acceptable for a
-- personal reminder app, but don't reuse this key/project for anything
-- more sensitive.
create policy "anon full access - subscriptions" on push_subscriptions
  for all using (true) with check (true);
create policy "anon full access - alerts" on scheduled_alerts
  for all using (true) with check (true);
