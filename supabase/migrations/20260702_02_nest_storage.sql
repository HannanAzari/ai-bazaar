-- ── M12 — Nest Platform: Storage buckets ─────────────────────────────────────
-- Images live in Storage buckets, never in DB tables (tables hold only URLs).
-- Public read for curated + published art; authenticated write for user content.
-- Idempotent.

insert into storage.buckets (id, name, public)
values
  ('backgrounds',     'backgrounds',     true),
  ('assets',          'assets',          true),
  ('templates',       'templates',       true),
  ('avatars',         'avatars',         true),
  ('user-uploads',    'user-uploads',    true),
  ('nest-thumbnails', 'nest-thumbnails', true)
on conflict (id) do nothing;

-- Public read for every Nest bucket (published Nests must render globally). ----
drop policy if exists nest_storage_public_read on storage.objects;
create policy nest_storage_public_read on storage.objects for select using (
  bucket_id in ('backgrounds', 'assets', 'templates', 'avatars', 'user-uploads', 'nest-thumbnails')
);

-- Curated library buckets (backgrounds/assets/templates): writes are service-role
-- only (admin upload script) — the service key bypasses RLS, so no write policy.

-- User content buckets: authenticated users may write their own files. ---------
drop policy if exists nest_storage_user_write on storage.objects;
create policy nest_storage_user_write on storage.objects for insert to authenticated with check (
  bucket_id in ('avatars', 'user-uploads', 'nest-thumbnails')
);
drop policy if exists nest_storage_user_update on storage.objects;
create policy nest_storage_user_update on storage.objects for update to authenticated using (
  bucket_id in ('avatars', 'user-uploads', 'nest-thumbnails')
);
