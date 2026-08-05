-- ── M24E — the interaction column the live project is still missing ──────────
--
-- WHY THIS FILE EXISTS, given that m24b_provision.sql was already applied.
--
-- `m24b_provision.sql` was applied BEFORE M24C appended the `scene_extras` column to it.
-- Live inspection of project srrmkdsvldlyllsxyhtq on 2026-08-05 confirms the split:
--
--     nests.draft_doc          EXISTS      (m24b, applied)
--     nests.draft_updated_at   EXISTS      (m24b, applied)
--     nest_views               EXISTS      (m24b, applied)
--     nests.scene_extras       MISSING  ←  (appended by M24C, never applied)
--
-- Every Focus region and every object placed inside one is therefore discarded at the
-- database boundary, no matter how correct the editor and the runtime are. That is the
-- root cause of "objects placed inside a Focus area are missing everywhere".
--
-- Re-running m24b_provision.sql would also work — it is idempotent — but a separate,
-- accurately-named file makes the outstanding action unambiguous.
--
-- ADDITIVE AND IDEMPOTENT. It creates nothing that exists, drops nothing, and rewrites no
-- row. Existing Nests keep working unchanged: a NULL `scene_extras` means "no Focus
-- regions", which is exactly what those Nests have.
--
-- Apply in the Supabase SQL editor. Safe to run more than once.

-- ── The canonical scene document ─────────────────────────────────────────────
--
-- Holds everything about a Nest that is NOT a root placement:
--
--   { version, focusAreas[], detailScenes[] }
--
-- focusAreas  — the creator's Focus regions: id, name, focusBounds (the single authored
--               rectangle that is both the tap target and the camera crop), childSceneId,
--               transition, trigger, enabled.
-- detailScenes— each Focus region's child scene: its own object manifest, with every
--               object's full geometry (x/y/width/height/rotation/zIndex/flipX) and its
--               own hotspots, bindings and surface content.
--
-- jsonb is the right shape: this is one creator-authored document read and written whole,
-- never queried field-by-field, and its schema versions with NEST_SCENE_VERSION rather
-- than with a migration. Object-level interaction data (hotspots, bindings, surface
-- content) already persists in `nest_objects.interaction`, which exists and is verified
-- lossless — this column covers only the scene graph above it.
alter table public.nests add column if not exists scene_extras jsonb;

comment on column public.nests.scene_extras is
  'M24C/M24E — canonical scene document: { version, focusAreas[], detailScenes[] }. '
  'Focus regions and the objects placed inside them. NULL = a Nest with no Focus regions.';

-- ── Verification ─────────────────────────────────────────────────────────────
--
-- Expect exactly one row: nests | scene_extras | jsonb | YES
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'nests'
  and column_name = 'scene_extras';
