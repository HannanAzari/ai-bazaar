-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK for nest_backgrounds_provision.sql — use ONLY if you must undo provisioning
-- and NO founder Nests have been published yet. This DROPS the Nest Library table.
--
-- ⚠ DESTRUCTIVE: dropping the table deletes any rows in it. Do NOT run if you have
-- published Nests you want to keep. The shared `nest_library_status` enum is left in
-- place (nest_assets depends on it). Prefer soft-hiding a Nest via status='archived'
-- over rollback.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists nest_backgrounds_read on public.nest_backgrounds;
drop table if exists public.nest_backgrounds;

notify pgrst, 'reload schema';
