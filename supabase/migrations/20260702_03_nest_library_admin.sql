-- ── M12.1 — Library admin curation (write RLS) ───────────────────────────────
-- Reads are public (migration _01). Admins curate status (approve/feature/hide/
-- archive) from the browser client, gated by the existing public.is_admin(). Items
-- are NEVER deleted — only status changes — so published Nests keep resolving
-- archived backgrounds/assets forever. Idempotent.

drop policy if exists nest_backgrounds_admin_write on public.nest_backgrounds;
create policy nest_backgrounds_admin_write on public.nest_backgrounds for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists nest_assets_admin_write on public.nest_assets;
create policy nest_assets_admin_write on public.nest_assets for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists nest_templates_admin_write on public.nest_templates;
create policy nest_templates_admin_write on public.nest_templates for update
  using (public.is_admin()) with check (public.is_admin());
