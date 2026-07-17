-- SCB 1st Grade 2026 — classroom parent app schema
-- Safe to re-run in full any time (every statement is idempotent) — this is
-- the single source of truth for the database. Run it in the Supabase SQL
-- Editor whenever you pull a version of the app with new tables/columns.

create extension if not exists "pgcrypto";

-- One row per child. Multiple parent profiles can point at the same family
-- (via profiles.family_id below) so two parents of the same kid get their
-- own logins and their own chat identity, but share one child name/photo
-- and don't show up as two separate "families" in the Directory.
create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  child_name text,
  child_avatar_url text,
  invite_code text unique default upper(substr(md5(random()::text), 1, 8)),
  created_at timestamptz not null default now()
);

alter table families enable row level security;

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
  family_id uuid references families (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table profiles add column if not exists phone text;
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists child_avatar_url text;
alter table profiles add column if not exists family_id uuid references families (id) on delete set null;

-- Backfill: every profile signed up before families existed gets its own
-- new family row (carrying over whatever child_name/photo it already had),
-- so every profile ends up with a family_id. New signups set family_id
-- directly at insert time and never hit this loop.
do $$
declare
  p record;
  new_family_id uuid;
begin
  for p in select id, child_name, child_avatar_url from profiles where family_id is null loop
    insert into families (child_name, child_avatar_url)
    values (p.child_name, p.child_avatar_url)
    returning id into new_family_id;

    update profiles set family_id = new_family_id where id = p.id;
  end loop;
end $$;

alter table profiles alter column family_id set not null;

-- Admin-curated links (school portal, class supply list, etc.), shown on
-- the Directory tab. Only ever written server-side via the service role
-- (see app/api/links) — parents can only read them.
create table if not exists links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Gifts & donations (Stripe Connect) ----------------------------------------
-- Real money moves here, routed entirely through Stripe Connect so this app
-- never takes custody of funds — Stripe is the licensed money transmitter;
-- this table just tracks which Express account is the current payout
-- destination. No client select policy at all (see below) — even the
-- account id shouldn't be exposed to the browser; status is served through
-- a dedicated API route (app/api/gifts/connect) instead. Only the service
-- role ever writes here.
create table if not exists payout_accounts (
  id uuid primary key default gen_random_uuid(),
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  connected_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table payout_accounts enable row level security;

-- A named collection toward one gift/donation purpose (holiday gift,
-- teacher appreciation week, a class fundraiser). Admin creates/closes
-- these; any signed-in parent can see and contribute to an open one.
create table if not exists gift_collections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  note text,
  target_cents integer,
  payout_account_id uuid references payout_accounts (id) on delete set null,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

alter table gift_collections enable row level security;

-- One row per contribution. Amounts are stored in cents to avoid floating
-- point drift. status starts 'pending' the moment a Checkout Session is
-- created and only flips to 'succeeded' once the Stripe webhook confirms
-- the charge actually went through — a successful redirect back to the app
-- is never on its own treated as proof of payment. platform_fee_cents is
-- kept for our own records but deliberately never rendered in the app UI
-- (Stripe's own dashboard is where that revenue gets reviewed) — same
-- reasoning as keeping business-margin info out of the classroom admin
-- screen entirely.
create table if not exists gift_contributions (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references gift_collections (id) on delete cascade,
  contributor_id uuid references profiles (id) on delete set null,
  amount_cents integer not null,
  platform_fee_cents integer not null default 0,
  note text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  created_at timestamptz not null default now()
);

alter table gift_contributions enable row level security;

create index if not exists gift_contributions_collection_idx on gift_contributions (collection_id);

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
  attachment_url text,
  attachment_name text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table reminders add column if not exists publish_at timestamptz not null default now();
alter table reminders add column if not exists notified_at timestamptz;
alter table reminders add column if not exists attachment_url text;
alter table reminders add column if not exists attachment_name text;

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
  body text,
  image_url text,
  created_at timestamptz not null default now()
);

-- body used to be required; a message can now be image-only, so relax that.
alter table messages alter column body drop not null;
alter table messages add column if not exists image_url text;

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
create index if not exists links_created_at_idx on links (created_at);

-- Row Level Security -----------------------------------------------------
-- Every table is readable by any signed-in classroom member (chat rooms and
-- messages are scoped further, below). Writes to profiles/events/reminders/
-- chat_rooms/chat_room_members only ever happen server-side with the
-- service role key (see lib/supabase/admin.js), which bypasses RLS
-- entirely — so no INSERT/UPDATE/DELETE policy is defined for those tables
-- except where parents post their own content directly (chat messages,
-- birthday invites).

alter table profiles enable row level security;
alter table links enable row level security;
alter table events enable row level security;
alter table reminders enable row level security;
alter table messages enable row level security;
alter table chat_rooms enable row level security;
alter table chat_room_members enable row level security;
alter table chat_read_state enable row level security;

drop policy if exists "profiles readable by classroom members" on profiles;
create policy "profiles readable by classroom members" on profiles
  for select to authenticated using (true);

-- Note: this also makes invite_code technically SELECT-able by anyone
-- signed in (Postgres RLS is row-level, not column-level, so there's no
-- clean way to hide just that one column from this same policy). The app
-- only ever fetches a family's own invite_code through a dedicated
-- server route scoped to the caller's own family_id — the Directory's
-- general listing query never requests that column — so this is a
-- defense-in-depth gap for a determined user poking at the API directly,
-- not something the normal app surfaces. Acceptable for a small trusted
-- classroom group; flagged here for anyone hardening this further.
drop policy if exists "families readable by classroom members" on families;
create policy "families readable by classroom members" on families
  for select to authenticated using (true);

drop policy if exists "links readable by classroom members" on links;
create policy "links readable by classroom members" on links
  for select to authenticated using (true);

-- payout_accounts deliberately has no select policy at all — not even a
-- restricted one. Status is only ever served through the service-role-
-- backed /api/gifts/connect/status route.

drop policy if exists "gift collections readable by classroom members" on gift_collections;
create policy "gift collections readable by classroom members" on gift_collections
  for select to authenticated using (true);

-- Contribution amounts/notes are visible to the whole classroom group by
-- design (same trusted-small-group transparency as the rest of the app) —
-- but the client only ever selects the public-safe columns (amount_cents,
-- note, contributor, status, created_at); stripe_checkout_session_id,
-- stripe_payment_intent_id, and platform_fee_cents are never requested by
-- client-side queries even though this policy technically allows it (the
-- same row-vs-column RLS limitation noted above for families.invite_code).
drop policy if exists "gift contributions readable by classroom members" on gift_contributions;
create policy "gift contributions readable by classroom members" on gift_contributions
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

-- Storage (chat photo attachments) ------------------------------------------
insert into storage.buckets (id, name, public)
  values ('chat-images', 'chat-images', true)
  on conflict (id) do nothing;

drop policy if exists "chat images are publicly accessible" on storage.objects;
create policy "chat images are publicly accessible" on storage.objects
  for select using (bucket_id = 'chat-images');

drop policy if exists "users can upload their own chat images" on storage.objects;
create policy "users can upload their own chat images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can delete their own chat images" on storage.objects;
create policy "users can delete their own chat images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Storage (reminder attachments) ---------------------------------------------
-- Any file type (permission slips, flyers, forms), not just images — only
-- admins ever upload here (see app/api/reminders), but the bucket policy
-- itself just follows the same per-uploader-folder pattern as the others.
insert into storage.buckets (id, name, public)
  values ('reminder-attachments', 'reminder-attachments', true)
  on conflict (id) do nothing;

drop policy if exists "reminder attachments are publicly accessible" on storage.objects;
create policy "reminder attachments are publicly accessible" on storage.objects
  for select using (bucket_id = 'reminder-attachments');

drop policy if exists "users can upload their own reminder attachments" on storage.objects;
create policy "users can upload their own reminder attachments" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'reminder-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can delete their own reminder attachments" on storage.objects;
create policy "users can delete their own reminder attachments" on storage.objects
  for delete to authenticated
  using (bucket_id = 'reminder-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
