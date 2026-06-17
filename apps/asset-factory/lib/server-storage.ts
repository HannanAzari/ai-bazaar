import { getServerSupabase, CANDIDATE_BUCKET } from "@/lib/supabase-server";
import { slugify } from "@/lib/slug";
import { type ImageStore } from "@/lib/image-provider";

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

/** Fetch a provider image URL and re-host it in the candidate bucket (V3). */
export async function uploadImageFromUrl(sourceUrl: string, name: string): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Failed to fetch generated image (${res.status}).`);
  const contentType = (res.headers.get("content-type") || "image/png").split(";")[0].trim();
  const type = contentType in EXT_FOR_TYPE ? contentType : "image/png";
  const bytes = new Uint8Array(await res.arrayBuffer());
  return uploadCandidateImage(bytes, type, name);
}

/** Decode a `data:image/...;base64,...` URL into bytes + content type. */
export function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const match = /^data:(image\/(?:png|webp));base64,(.*)$/i.exec(dataUrl);
  if (!match) throw new Error("Expected a base64 PNG or WebP data URL.");
  const contentType = match[1].toLowerCase();
  const bytes = Uint8Array.from(Buffer.from(match[2], "base64"));
  return { bytes, contentType };
}

/**
 * Shared-mode image store (V3.3): re-host provider URLs and upload base64 bytes
 * into the candidate bucket, returning a public URL. Used for both Replicate
 * (URL) and OpenAI (base64) outputs.
 */
export const bucketImageStore: ImageStore = async (image, name) => {
  if (image.url) return uploadImageFromUrl(image.url, name);
  if (image.b64) {
    const bytes = Uint8Array.from(Buffer.from(image.b64, "base64"));
    return uploadCandidateImage(bytes, image.contentType ?? "image/png", name);
  }
  return null;
};
