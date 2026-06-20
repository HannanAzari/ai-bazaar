import { type AssetCandidate } from "@/lib/types";
import { decodeDataUrl } from "@/lib/server-storage";
import { isPlaceholderUrl } from "@/lib/asset-persist";

// Server-side saver (V3.7.5): persists approved real OpenAI assets to Supabase —
// uploads the PNG to Storage and upserts the candidate row. The I/O is INJECTED
// (uploadImage / upsertCandidate / isSupabasePublicUrl / fetch) so this is fully
// unit-testable without a live Supabase or network. The route wires the real deps.

export type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status?: number;
  headers?: { get(name: string): string | null };
  arrayBuffer: () => Promise<ArrayBuffer>;
}>;

export type SupabaseSaveDeps = {
  /** Upload bytes to Storage at interior-v1/<id>.png (upsert) → public URL. */
  uploadImage: (bytes: Uint8Array, contentType: string, id: string) => Promise<string>;
  /** Upsert the candidate row (by id). */
  upsertCandidate: (c: AssetCandidate) => Promise<void>;
  /** Whether a url is already a public Supabase Storage url. */
  isSupabasePublicUrl: (url: string) => boolean;
  fetchImpl?: FetchLike;
};

export type SupabaseSaveResult = {
  saved: number;
  uploaded: number;
  kept: number;
  skipped: number;
  assets: AssetCandidate[];
};

async function resolveBytes(url: string, fetchImpl?: FetchLike): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (url.startsWith("data:")) {
    try { return decodeDataUrl(url); } catch { return null; }
  }
  if (/^https?:\/\//i.test(url)) {
    const doFetch = fetchImpl ?? ((u: string) => fetch(u));
    const res = await doFetch(url);
    if (!res.ok) return null;
    const raw = (res.headers?.get("content-type") || "image/png").split(";")[0].trim().toLowerCase();
    const contentType = raw === "image/webp" ? "image/webp" : "image/png";
    return { bytes: new Uint8Array(await res.arrayBuffer()), contentType };
  }
  return null;
}

/**
 * Persist approved real OpenAI candidates to Supabase. For each: upload the image to
 * Storage (or keep an existing Supabase url), then upsert the row with status
 * `approved`, source `style_lab`, provider/model normalized. Dedupe is by id (upsert)
 * — and since the storage path is interior-v1/<id>.png, the same id reuses one file
 * and one row. Non-OpenAI, placeholder, or unresolvable images are skipped.
 */
export async function saveApprovedAssetsToSupabase(
  candidates: AssetCandidate[],
  deps: SupabaseSaveDeps,
): Promise<SupabaseSaveResult> {
  const out: AssetCandidate[] = [];
  let uploaded = 0;
  let kept = 0;
  let skipped = 0;

  for (const c of candidates) {
    const url = (c.imageUrl || "").trim();
    if (c.modelProvider !== "openai" || !url || isPlaceholderUrl(url)) { skipped += 1; continue; }

    let publicUrl: string;
    if (deps.isSupabasePublicUrl(url)) {
      publicUrl = url; // already hosted — keep it
      kept += 1;
    } else {
      const got = await resolveBytes(url, deps.fetchImpl);
      if (!got) { skipped += 1; continue; }
      publicUrl = await deps.uploadImage(got.bytes, got.contentType, c.id);
      uploaded += 1;
    }

    const row: AssetCandidate = {
      ...c,
      imageUrl: publicUrl,
      status: "approved",
      source: "style_lab",
      modelProvider: "openai",
      modelName: c.modelName || "gpt-image-1",
    };
    await deps.upsertCandidate(row);
    out.push(row);
  }

  return { saved: out.length, uploaded, kept, skipped, assets: out };
}
