# SCB 1st Grade 2026 — Classroom Parent App

A mobile-first web app (installable to your phone's home screen, no app
store needed) for our classroom family. Built with Next.js 14, Supabase,
and Claude.

**What's in it:**
- **Home** — this week's quick reminders + upcoming events at a glance
- **Scheduled reminders** — the admin can post a reminder immediately or
  schedule it for a future date/time; it stays hidden (no push, no email)
  until then, so she can prep announcements ahead of time
- **Calendar** — a week view by default (today highlighted, day-by-day, "No
  events" for empty days) with a Month view toggle for looking further out,
  plus a one-tap "Add to Google Calendar" link on every event
- **Birthday invites** — any parent can post one for their own kid (host,
  location, RSVP details); it shows up on the shared calendar automatically
- **Chat** — a room list you tap into (like a messaging app); everyone's in
  "Main Chat" by default, plus the admin can spin up extra invite-only rooms
  for specific parents. Photos can be attached to a message and saved from
  the chat by anyone who receives them.
- **Directory** — every parent's name, email, phone, and photo, so families
  can reach out directly about birthday parties and playdates
- **Weekly email digest** — everyone gets an email every week with the
  reminders and upcoming events, even if they never open the app
- **Phone notifications** — parents can turn on push notifications
  (Directory tab) and get alerted the moment a new reminder or chat message
  goes out, even with the app closed
- **Admin** — the room parent gets an admin screen to post reminders and
  events by hand, *or* just type what she wants in plain English to an
  embedded Claude assistant ("remind everyone about picture day Friday")
  and it makes the update for her

## How membership works

There's no public sign-up. Two invite codes (that you make up) gate
joining:

- **Parent code** — share this with classroom families. Anyone with it can
  create an account and see reminders/calendar/chat.
- **Admin code** — gives whoever signs up with it the room-parent admin
  role (access to `/admin`, including the AI assistant). Keep this one
  private — usually you'll use it yourself to create the first account.

Codes are plain environment variables (`CLASSROOM_PARENT_INVITE_CODE`,
`CLASSROOM_ADMIN_INVITE_CODE`), not stored in the database, so rotating
them just means updating an env var and redeploying.

## One-time setup

### 1. Supabase (data, auth, chat)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run `supabase/schema.sql` from this repo (it's safe
   to re-run in full any time you pull an update with new tables/columns)
   — it creates the `profiles`, `events`, `reminders`, `chat_rooms`,
   `chat_room_members`, and `messages` tables, locks them down with Row
   Level Security, turns on realtime for chat, and sets up the `avatars`
   Storage bucket for profile pictures.
3. From **Project Settings → API**, copy the Project URL, `anon` public
   key, and `service_role` secret key into your env vars (see
   `.env.example`).

### 2. Anthropic (the AI assistant)

Create an API key at [console.anthropic.com](https://console.anthropic.com)
and set `ANTHROPIC_API_KEY`. Usage is billed per request to your Anthropic
account — for a classroom-sized assistant used a few times a week this
costs pennies, but keep an eye on it. If this key is left unset, the rest
of the app still works fine — the admin just uses the plain forms instead
of the chat assistant.

### 3. Resend (weekly reminder emails)

1. Create a free account at [resend.com](https://resend.com).
2. Verify a sending domain (or use their test domain while developing).
3. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

### 4. Web Push (phone notifications)

Run `npx web-push generate-vapid-keys` locally — it prints a public and
private key pair, no account/signup needed. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (any `mailto:` address) from the
output. If these are left unset, everything else still works — parents just
won't see the "Turn on notifications" option do anything.

Note: on iPhone, push notifications only work once the app has been added
to the Home Screen (regular Safari tabs can't receive them) and requires
iOS 16.4+.

### 5. Local development

```bash
npm install
cp .env.example .env.local   # fill in the values above
npm run dev
```

Visit `/signup` and create the first account using your admin invite code.

## Deploying (Vercel)

1. Push this repo to GitHub (already done if you're reading this here).
2. In Vercel, **Add New → Project**, import this repo. Framework preset:
   Next.js (auto-detected).
3. Add all the environment variables from `.env.example` in
   **Project Settings → Environment Variables**, then deploy.
4. Vercel Cron (configured in `vercel.json`) runs two jobs: `/api/cron/weekly-digest`
   every **Sunday at 13:00 UTC**, and `/api/cron/publish-reminders` **daily
   at 13:00 UTC** (this is what fires the push notification for a scheduled
   reminder once its time arrives — the reminder itself appears in the app
   right on schedule regardless, this only affects the push). Adjust the
   `schedule` values in `vercel.json` for your timezone
   ([crontab.guru](https://crontab.guru) helps). Vercel automatically sends
   `Authorization: Bearer $CRON_SECRET` on cron requests once you've set
   `CRON_SECRET`, which both routes check.

   Note: Vercel's free/Hobby plan only runs each cron job **once a day**, so
   a reminder scheduled for e.g. 2pm won't push until the next day's cron
   run — the app itself still shows it exactly on time either way. This
   only matters if you're on Hobby and want the push notification itself to
   be prompt; upgrade to Pro if that precision matters to you.
5. Once deployed, visit the site on a phone and use the browser's
   **"Add to Home Screen"** option (Safari: Share → Add to Home Screen;
   Chrome: menu → Install app) so it opens full-screen like a native app.

## Structure

- `app/(auth)/login`, `app/(auth)/signup` — sign in / join with invite code
- `app/home` — weekly reminders + upcoming events dashboard
- `app/calendar` — week/month calendar views (`WeekView`/`MonthView`,
  sharing an `EventCard`), birthday invite posting, and "Add to Google
  Calendar" links
- `app/chat` — room list ("Main Chat" + any invite-only rooms the admin
  created via `app/api/chat-rooms`); `app/chat/[roomId]` is the realtime
  message thread (Supabase Realtime) for one room, including photo
  attachments (uploaded to the `chat-images` Storage bucket)
- `app/directory` — every parent's contact info + self-service photo/phone/
  child name editing (`app/api/profile`) and the notifications toggle
- `app/admin` — room-parent-only: reminder/event forms + the AI assistant
- `app/api/auth/signup` — validates invite code, creates the account
- `app/api/reminders`, `app/api/events` — admin-only create/delete
  (parents can also post/delete their own birthday-type events directly,
  enforced by Row Level Security rather than these routes)
- `app/api/admin/assistant` — Claude tool-use loop that can create, list,
  and delete reminders/events on the admin's behalf (see `lib/assistantTools.js`
  for exactly what it's allowed to touch — nothing outside those two tables)
- `app/api/messages` — posts a chat message server-side (rather than a
  direct client insert) so it has a hook to fan out push notifications
- `app/api/push/subscribe` — saves/removes a device's push subscription
- `app/api/cron/weekly-digest` — builds and sends the weekly email
- `app/api/cron/publish-reminders` — daily job that pushes the notification
  for any scheduled reminder whose time has arrived (visibility itself is
  just a query filter, not cron-dependent)
- `public/sw.js` — the service worker that receives and displays push
  notifications; `lib/pushClient.js`/`lib/pushNotify.js` are the client/
  server halves of the Web Push flow
- `components/InstallPrompt.jsx` — nudges visitors to add the app to their
  home screen (native prompt on Android/Chrome, instructions on iOS)
- `supabase/schema.sql` — database schema + Row Level Security policies +
  Storage bucket setup
- `supabase/seed-sample-events.sql` — optional, run-once: a handful of
  placeholder calendar events so things aren't empty while testing;
  deletable later from the Admin tab like any other event
- `middleware.js` — redirects signed-out visitors to `/login` for pages,
  and returns a JSON 401 (not an HTML redirect) for API calls

## Notes before you invite families

- The app icon (`public/icons/icon.svg`) is a placeholder — swap in real
  artwork before sharing widely.
- Chat has no moderation tooling yet (no delete/report) — it's a small
  trusted group, but keep that in mind.
- The admin assistant can only read/write the `reminders` and `events`
  tables — it has no access to parent accounts, chat messages, or anything
  else in the database.
- Every parent's email/phone/photo is visible to every other signed-in
  parent (that's the point of the Directory) — there's no per-field privacy
  toggle in this version.
- Chat room membership is set at creation time — to change who's in a
  room, delete it and recreate it with the right people for now.
