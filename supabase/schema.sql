-- SCB 1st Grade 2026 — classroom parent app schema
-- Run this once in the Supabase SQL Editor for your project.

create extension if not exists "pgcrypto";

-- One row per signed-up parent/admin, keyed to auth.users.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  child_name text,
  role text not null default 'parent' check (role in ('parent', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  week_of date not null default date_trunc('week', now())::date,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists events_start_at_idx on events (start_at);
create index if not exists reminders_week_of_idx on reminders (week_of);
create index if not exists messages_created_at_idx on messages (created_at);

-- Row Level Security -----------------------------------------------------
-- Every table is readable by any signed-in classroom member. Writes to
-- profiles/events/reminders only ever happen server-side with the service
-- role key (see lib/supabase/admin.js), which bypasses RLS entirely — so no
-- INSERT/UPDATE/DELETE policy is defined for those tables on purpose.
-- Chat messages are the one thing parents post themselves, so they get an
-- INSERT policy scoped to their own user id.

alter table profiles enable row level security;
alter table events enable row level security;
alter table reminders enable row level security;
alter table messages enable row level security;

create policy "profiles readable by classroom members" on profiles
  for select to authenticated using (true);

create policy "events readable by classroom members" on events
  for select to authenticated using (true);

create policy "reminders readable by classroom members" on reminders
  for select to authenticated using (true);

create policy "messages readable by classroom members" on messages
  for select to authenticated using (true);

create policy "parents can post their own chat messages" on messages
  for insert to authenticated with check (auth.uid() = user_id);

-- Realtime -----------------------------------------------------------------
-- Enable realtime updates for the chat room (safe to re-run).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;
