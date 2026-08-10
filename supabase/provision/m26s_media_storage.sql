-- ── M26-S §9 — a real home for creator media ─────────────────────────────────
--
-- WHY THIS EXISTS.
--
-- Uploaded photos and videos were being persisted as base64 `data:` URLs inside the Nest
-- document. That is wrong in four separate ways, and it is already in the live database:
--
--   1. SIZE. A single phone photo is 2–5 MB; base64 inflates it ~33%. It lands in
--      `nest_objects.interaction` (jsonb) and is re-sent on every feed read, every card,
--      every Profile — for every visitor.
--   2. The document stops being a document. It becomes a file container.
--   3. No caching, no CDN, no resizing, no thumbnails.
--   4. It is visible to the creator as a wall of `data:image/jpeg;base64,/9j/4AAQ…`,
--      which is what the founder reported.
--
-- Media now goes to Storage and the document keeps only a reference.
--
-- ADDITIVE AND IDEMPOTENT. Creates one bucket and its policies; drops nothing; rewrites
-- no row. Existing Nests carrying base64 keep working — the runtime still renders a
-- `data:` URL it finds — they are simply never written that way again.
--
-- Apply in the Supabase SQL editor. Safe to run more than once.

-- ── The bucket ───────────────────────────────────────────────────────────────
--
-- PUBLIC on purpose: this is media a creator has chosen to put in a Nest that anyone can
-- visit. A private bucket would need a signed URL per object per render, which is a lot of
-- machinery to protect something the creator is publishing anyway. Private media is a
-- different feature and should get a different bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nest-media',
  'nest-media',
  true,
  26214400, -- 25 MB: comfortably a phone photo or a short clip, far below a base64 blob
  array['image/jpeg','image/png','image/webp','image/gif','image/avif','video/mp4','video/webm','video/quicktime','audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Policies ─────────────────────────────────────────────────────────────────
--
-- Objects are keyed `<owner_uid>/<nest-id>/<file>`, so `storage.foldername(name)[1]` is the
-- owner. That is what lets a creator manage only their own media with no extra table.

drop policy if exists "nest_media_read" on storage.objects;
create policy "nest_media_read"
  on storage.objects for select
  using (bucket_id = 'nest-media');

drop policy if exists "nest_media_insert_own" on storage.objects;
create policy "nest_media_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'nest-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "nest_media_update_own" on storage.objects;
create policy "nest_media_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'nest-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "nest_media_delete_own" on storage.objects;
create policy "nest_media_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'nest-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Verification ─────────────────────────────────────────────────────────────
--
-- Expect one bucket row and four policies.
select id, public, file_size_limit from storage.buckets where id = 'nest-media';
select policyname from pg_policies
 where schemaname = 'storage' and tablename = 'objects' and policyname like 'nest_media_%'
 order by policyname;
