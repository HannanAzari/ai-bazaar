-- Step 1 of the creator-identity & engagement sprint.
-- A new enum value must be committed in its own migration before any later
-- statement (the reports check below, in _02) is allowed to reference it.

-- Guestbook notes are now a reportable target alongside houses, items, and users.
alter type public.report_target_type add value if not exists 'guestbook';
