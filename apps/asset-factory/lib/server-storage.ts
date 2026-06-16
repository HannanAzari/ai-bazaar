import { getServerSupabase, CANDIDATE_BUCKET } from "@/lib/supabase-server";
import { slugify } from "@/lib/slug";

// Upload an imported/uploaded image into the Supabase Storage bucket (V2) and
// return its public URL. Server-only — runs behind the password gate.

const EXT_FOR_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Upload raw image bytes to the candidate bucket. `name` seeds a readable path;
 * a timestamp keeps it unique. Returns the public URL.
 */
export async function uploadCandidateImage(
  bytes: ArrayBuffer | Uint8Array,
  contentType: string,
  name: string,
): Promise<string> {
  const ext = EXT_FOR_TYPE[contentType];
  if (!ext) throw new Error("Only PNG or WebP images are accepted.");

  const supabase = getServerSupabase();
  const path = `${slugify(name) || "asset"}-${Date.now().toString(36)}.${ext}`;
  const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  const { error } = await supabase.storage
    .from(CANDIDATE_BUCKET)
    .upload(path, body, { contentType, upsert: false });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(CANDIDATE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Decode a `data:image/...;base64,...` URL into bytes + content type. */
export function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const match = /^data:(image\/(?:png|webp));base64,(.*)$/i.exec(dataUrl);
  if (!match) throw new Error("Expected a base64 PNG or WebP data URL.");
  const contentType = match[1].toLowerCase();
  const bytes = Uint8Array.from(Buffer.from(match[2], "base64"));
  return { bytes, contentType };
}
