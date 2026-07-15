-- Optional, run-once seed data — a handful of realistic placeholder events
-- so the calendar isn't empty while you're testing. Not part of schema.sql
-- on purpose (re-running schema.sql shouldn't keep adding more of these).
--
-- Every row here is a normal general-purpose event with no owner
-- (created_by is left null), so the admin can delete any of them later
-- from the Admin tab's event list, same as anything else.

insert into events (title, description, location, start_at, all_day, event_type)
values
  ('Picture Day', 'Wear your best smile! Order forms due by Friday.', 'Cafeteria', '2026-07-16 09:00', false, 'general'),
  ('No School – Staff Development Day', null, null, '2026-07-17 00:00', true, 'general'),
  ('Back to School Night', 'Meet the teacher and see the classroom.', 'Room 12', '2026-07-21 18:00', false, 'general'),
  ('Field Trip – Community Zoo', 'Bring $10 and a bagged lunch. Meet at the front entrance by 9:45.', 'Community Zoo', '2026-07-24 10:00', false, 'general'),
  ('Book Fair Kickoff', 'Stop by the library after school to browse.', 'Library', '2026-07-29 15:00', false, 'general'),
  ('Spirit Week – Pajama Day', null, null, '2026-08-03 00:00', true, 'general'),
  ('PTA Meeting', 'All parents welcome — light snacks provided.', 'Gym', '2026-08-07 17:30', false, 'general');
