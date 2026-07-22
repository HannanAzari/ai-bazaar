-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK for beta_nest_assets_provision.sql — use ONLY to undo provisioning, and
-- ONLY when `nest_assets` holds no data you need (drops are destructive by nature).
-- Touches nothing else; never references public.assets (V1).
-- ─────────────────────────────────────────────────────────────────────────────

-- (optional) inspect first: select count(*) from public.nest_assets;

drop policy if exists nest_assets_read on public.nest_assets;
drop table if exists public.nest_assets;         -- remove ONLY if empty/unwanted
drop type if exists public.nest_library_status;  -- only if no other table uses it
notify pgrst, 'reload schema';
