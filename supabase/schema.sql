-- SCB 1st Grade 2026 — classroom parent app schema
-- Safe to re-run in full any time (every statement is idempotent) — this is
-- the single source of truth for the database. Run it in the Supabase SQL
-- Editor whenever you pull a version of the app with new tables/columns.

create extension if not exists "pgcrypto";

-- One row per signed-up parent/admin, keyed to auth.users.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  child_name text,
  phone text,
  avatar_url text,
  child_avatar_url text,
  role text not null default 'parent' check (role in ('parent', 'admin')),
  created_at timestamptz not null default now()
);

alter table profiles add column if not exists phone text;
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists child_avatar_url text;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  image_url text,
  event_type text not null default 'general' check (event_type in ('general', 'birthday')),
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table events add column if not exists location text;
alter table events add column if not exists image_url text;
alter table events add column if not exists event_type text not null default 'general';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_event_type_check'
  ) then
    alter table events add constraint events_event_type_check
      check (event_type in ('general', 'birthday'));
  end if;
end $$;

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  week_of date not null default date_trunc('week', now())::date,
  publish_at timestamptz not null default now(),
  notified_at timestamptz,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table reminders add column if not exists publish_at timestamptz not null default now();
alter table reminders add column if not exists notified_at timestamptz;

-- Reminders created before scheduling existed have no way to have been
-- "scheduled", so backfill notified_at so the publish-reminders cron
-- doesn't try to (re-)notify everyone about old reminders on first run.
update reminders set notified_at = created_at where notified_at is null;

-- Web Push subscriptions, one row per device a parent has enabled
-- notifications on. Only ever read/written server-side with the service
-- role (see lib/pushNotify.js and app/api/push/subscribe) — no client RLS
-- write policy is defined, so RLS is enabled purely to block anon/
-- authenticated access by default.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);
alter table push_subscriptions enable row level security;

-- Chat rooms. There's always exactly one "default" room every classroom
-- member can see (the general room chat); admins can additionally create
-- invite-only rooms scoped to specific parents via chat_room_members.
create table if not exists chat_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists chat_room_members (
  room_id uuid not null references chat_rooms (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

insert into chat_rooms (name, is_default)
  select 'Main Chat', true
  where not exists (select 1 from chat_rooms where is_default);

update chat_rooms set name = 'Main Chat' where is_default and name = 'Room chat';

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references chat_rooms (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table messages add column if not exists room_id uuid references chat_rooms (id) on delete cascade;

update messages set room_id = (select id from chat_rooms where is_default limit 1)
  where room_id is null;

alter table messages alter column room_id set not null;

-- Tracks the last time each parent opened each room, so unread counts can
-- be computed as "messages in this room newer than my last_read_at".
create table if not exists chat_read_state (
  user_id uuid not null references profiles (id) on delete cascade,
  room_id uuid not null references chat_rooms (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, room_id)
);

create index if not exists events_start_at_idx on events (start_at);
create index if not exists reminders_week_of_idx on reminders (week_of);
create index if not exists reminders_publish_at_idx on reminders (publish_at);
create index if not exists messages_room_created_at_idx on messages (room_id, created_at);
create index if not exists chat_room_members_user_idx on chat_room_members (user_id);

-- Row Level Security -----------------------------------------------------
-- Every table is readable by any signed-in classroom member (chat rooms and
-- messages are scoped further, below). Writes to profiles/events/reminders/
-- chat_rooms/chat_room_members only ever happen server-side with the
-- service role key (see lib/supabase/admin.js), which bypasses RLS
-- entirely — so no INSERT/UPDATE/DELETE policy is defined for those tables
-- except where parents post their own content directly (chat messages,
-- birthday invites).

alter table profiles enable row level security;
alter table events enable row level security;
alter table reminders enable row level security;
alter table messages enable row level security;
alter table chat_rooms enable row level security;
alter table chat_room_members enable row level security;
alter table chat_read_state enable row level security;

drop policy if exists "profiles readable by classroom members" on profiles;
create policy "profiles readable by classroom members" on profiles
  for select to authenticated using (true);

drop policy if exists "events readable by classroom members" on events;
create policy "events readable by classroom members" on events
  for select to authenticated using (true);

-- Any parent can post (or remove) a birthday invite for their own kid —
-- everything else about the shared calendar stays admin-only.
drop policy if exists "parents can post their own birthday invites" on events;
create policy "parents can post their own birthday invites" on events
  for insert to authenticated
  with check (event_type = 'birthday' and created_by = auth.uid());

drop policy if exists "parents can delete their own birthday invites" on events;
create policy "parents can delete their own birthday invites" on events
  for delete to authenticated
  using (event_type = 'birthday' and created_by = auth.uid());

drop policy if exists "reminders readable by classroom members" on reminders;
create policy "reminders readable by classroom members" on reminders
  for select to authenticated using (true);

drop policy if exists "members can see their rooms" on chat_rooms;
create policy "members can see their rooms" on chat_rooms
  for select to authenticated using (
    is_default
    or exists (
      select 1 from chat_room_members m
      where m.room_id = chat_rooms.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "members can see their own membership rows" on chat_room_members;
create policy "members can see their own membership rows" on chat_room_members
  for select to authenticated using (user_id = auth.uid());

-- Each parent marks their own rooms read directly from the client (no
-- server route needed — it's just "I looked at this", nothing sensitive).
drop policy if exists "users manage their own read state" on chat_read_state;
create policy "users manage their own read state" on chat_read_state
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "messages readable by classroom members" on messages;
drop policy if exists "messages readable by room members" on messages;
create policy "messages readable by room members" on messages
  for select to authenticated using (
    exists (
      select 1 from chat_rooms r
      where r.id = messages.room_id
        and (
          r.is_default
          or exists (
            select 1 from chat_room_members m
            where m.room_id = r.id and m.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "parents can post their own chat messages" on messages;
drop policy if exists "room members can post their own chat messages" on messages;
create policy "room members can post their own chat messages" on messages
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (
      select 1 from chat_rooms r
      where r.id = messages.room_id
        and (
          r.is_default
          or exists (
            select 1 from chat_room_members m
            where m.room_id = r.id and m.user_id = auth.uid()
          )
        )
    )
  );

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

-- Storage (profile pictures) ------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

drop policy if exists "avatar images are publicly accessible" on storage.objects;
create policy "avatar images are publicly accessible" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "users can upload their own avatar" on storage.objects;
create policy "users can upload their own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can update their own avatar" on storage.objects;
create policy "users can update their own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can delete their own avatar" on storage.objects;
create policy "users can delete their own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Storage (birthday invite images) ------------------------------------------
insert into storage.buckets (id, name, public)
  values ('event-images', 'event-images', true)
  on conflict (id) do nothing;

drop policy if exists "event images are publicly accessible" on storage.objects;
create policy "event images are publicly accessible" on storage.objects
  for select using (bucket_id = 'event-images');

drop policy if exists "users can upload their own event images" on storage.objects;
create policy "users can upload their own event images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can update their own event images" on storage.objects;
create policy "users can update their own event images" on storage.objects
  for update to authenticated
  using (bucket_id = 'event-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can delete their own event images" on storage.objects;
create policy "users can delete their own event images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'event-images' and (storage.foldername(name))[1] = auth.uid()::text);
