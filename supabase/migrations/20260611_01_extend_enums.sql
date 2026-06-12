-- Step 1 of the discovery/moderation update.
-- New enum values must be committed in their own migration before any later
-- statement (defaults, checks, inserts) is allowed to reference them.

-- Reports can now target a user, not just a shop or decoration.
alter type public.report_target_type add value if not exists 'user';

-- Moderation statuses: pending → reviewed / hidden / dismissed.
-- Older values (open, reviewing, resolved) remain for backward compatibility.
alter type public.report_status add value if not exists 'pending';
alter type public.report_status add value if not exists 'reviewed';
alter type public.report_status add value if not exists 'hidden';
