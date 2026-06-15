import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImageStorage, UploadResult } from "@/lib/storage/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Production image storage — Supabase Storage behind the existing ImageStorage
// interface, so studio components keep calling getImageStorage().upload() with no
// change. Uploads go to a public bucket; this is the storage layer only — no room
// visual changes, no image generation.

export const IMAGE_BUCKET = "room-images";

export class SupabaseStorage implements ImageStorage {
  private db: SupabaseClient;
  private bucket: string;

  constructor(db?: SupabaseClient | null, bucket = IMAGE_BUCKET) {
    const resolved = db ?? createSupabaseBrowserClient();
    if (!resolved) throw new Error("Supabase client unavailable — SupabaseStorage requires Supabase env vars.");
    this.db = resolved;
    this.bucket = bucket;
  }

  async upload(file: File, path: string): Promise<UploadResult> {
    // Namespace the key to avoid collisions; keep the caller's path as a prefix.
    const key = `${path.replace(/^\/+|\/+$/g, "")}/${Date.now()}-${file.name}`.replace(/\/+/g, "/");
    const { error } = await this.db.storage.from(this.bucket).upload(key, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    const { data } = this.db.storage.from(this.bucket).getPublicUrl(key);
    return { key, publicUrl: data.publicUrl };
  }

  async remove(key: string): Promise<void> {
    const { error } = await this.db.storage.from(this.bucket).remove([key]);
    if (error) throw error;
  }
}
