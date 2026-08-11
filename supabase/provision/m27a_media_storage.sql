-- ── M27A — the nest-media bucket, and the reason uploads have never worked ───
--
-- ROOT CAUSE, verified against the live project before writing this file:
--
--     GET /storage/v1/bucket  ->  200  []
--     POST /storage/v1/object/nest-media/...  ->  {"code":"NoSuchBucket"}
--
-- The project has ZERO storage buckets. `nest-media` was specified in
-- `m26s_media_storage.sql` but that file was never applied, so every upload has failed at
-- the first call with "Bucket not found". Nothing in the client code was broken.
--
-- This file supersedes `m26s_media_storage.sql`. Applying it is enough on its own; you do
-- not need to run the M26-S file first, and running both is harmless.
--
-- ADDITIVE AND IDEMPOTENT. Creates one bucket and four policies. Drops no data, rewrites
-- no row, and is safe to run repeatedly.
--
--     Apply in: Supabase dashboard → SQL Editor → paste → Run.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- THE BUCKET
-- ─────────────────────────────────────────────────────────────────────────────
--
-- PUBLIC, deliberately. This is media a creator has chosen to put in a Nest that anyone
-- can visit. A private bucket would need a signed URL minted per object per render — a lot
-- of machinery to protect something that is being published anyway.
--
-- HONEST CAVEAT: "public" means readable by anyone holding the URL, including media
-- attached to a Nest that has not been published yet. Object keys embed two UUIDs, so they
-- are not guessable, but this is obscurity rather than authorisation. If draft media ever
-- needs to be genuinely private, that is a SECOND bucket with signed URLs — not a policy
-- change here, because flipping this bucket to private would break every published Nest.
--
-- MIME allow-list: images and video only for M27A. Audio is deliberately absent; adding it
-- is a one-line change here plus the matching entry in `lib/nest-media.ts`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nest-media',
  'nest-media',
  true,
  26214400, -- 25 MB. A phone photo is 2–5 MB and a short clip fits; large enough not to
            -- annoy, small enough that one object cannot wreck a feed read.
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────────────
-- POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Canonical object key:
--
--     <ownerId>/<nestId>/<objectId>/<mediaId>.<ext>
--
-- The FIRST path segment is the owner's auth uid, so `(storage.foldername(name))[1]` is the
-- owner. That single fact is what lets a creator manage exactly their own media with no
-- ownership table, no join, and no service-role key anywhere near the client.
--
-- `storage.foldername('a/b/c/d.png')` returns {a,b,c} — the directory segments — so
-- element 1 is the owner id for any key with at least one directory.

-- READ — anyone. See the caveat above; this is what makes a published Nest render for a
-- visitor who is not signed in.
drop policy if exists "nest_media_read" on storage.objects;
create policy "nest_media_read"
  on storage.objects for select
  using (bucket_id = 'nest-media');

-- INSERT — a signed-in creator, only under their own uid prefix.
drop policy if exists "nest_media_insert_own" on storage.objects;
create policy "nest_media_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'nest-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE — replacing one's own object (upsert, metadata changes).
-- Both USING and WITH CHECK: USING decides which rows may be targeted, WITH CHECK decides
-- what they may become. Without the second, a creator could move an object into someone
-- else's prefix.
drop policy if exists "nest_media_update_own" on storage.objects;
create policy "nest_media_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'nest-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'nest-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE — a creator removes their own media. This is what makes "remove the item and the
-- storage object goes too" possible without orphaning uploads.
drop policy if exists "nest_media_delete_own" on storage.objects;
create policy "nest_media_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'nest-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY — run these after applying; both should return a row / true.
-- ─────────────────────────────────────────────────────────────────────────────
--
--   select id, public, file_size_limit, allowed_mime_types
--     from storage.buckets where id = 'nest-media';
--
--   select policyname from pg_policies
--    where schemaname = 'storage' and tablename = 'objects'
--      and policyname like 'nest_media%';
--   -- expect: nest_media_read, nest_media_insert_own,
--   --         nest_media_update_own, nest_media_delete_own
