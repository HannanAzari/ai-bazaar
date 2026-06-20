import { describe, it, expect } from "vitest";
import { saveApprovedAssetsToSupabase, type SupabaseSaveDeps, type FetchLike } from "@/lib/asset-persist-server";
import { isPlaceholderUrl, isSupabasePublicUrl, interiorStoragePath } from "@/lib/asset-persist";
import { decodeDataUrl } from "@/lib/server-storage";
import { savedFromStyleLab } from "@/lib/style-lab";
import { exportJson } from "@/lib/export";
import { type AssetCandidate } from "@/lib/types";

const PNG_1x1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const PUBLIC = "https://proj.supabase.co/storage/v1/object/public/asset-candidates/interior-v1/x.png";

function cand(over: Partial<AssetCandidate> = {}): AssetCandidate {
  return {
    id: "sl-x", name: "X", slug: "x", category: "sofa", pack: "style-lab", status: "approved",
    imageUrl: PNG_1x1, prompt: "p", negativePrompt: "", modelProvider: "openai", modelName: "gpt-image-1",
    seed: 1, width: 1024, height: 1024, transparent: false, tags: ["x"], compatibleZones: ["floor_center"],
    placementType: "floor", defaultScale: 1, defaultActionType: "none", styleScore: 90, qualityNotes: "",
    reviewer: "style-lab", reviewedAt: "", personality: "Minimalist", source: "style_lab",
    sourceSampleId: "dna-x", createdAt: "2026-01-01T00:00:00.000Z", ...over,
  };
}

/** Capturing deps: records uploads + a fake DB keyed by id (so upsert dedupes). */
function makeDeps(extra: Partial<SupabaseSaveDeps> = {}) {
  const uploads: { id: string; len: number; contentType: string }[] = [];
  const db = new Map<string, AssetCandidate>();
  const deps: SupabaseSaveDeps = {
    uploadImage: async (bytes, contentType, id) => {
      uploads.push({ id, len: bytes.length, contentType });
      return `https://proj.supabase.co/storage/v1/object/public/asset-candidates/${interiorStoragePath(id).split("/").pop()}`;
    },
    upsertCandidate: async (c) => { db.set(c.id, c); },
    isSupabasePublicUrl,
    ...extra,
  };
  return { deps, uploads, db };
}

describe("asset-persist pure helpers (V3.7.5)", () => {
  it("classifies urls", () => {
    expect(isPlaceholderUrl("/samples/x.png")).toBe(true);
    expect(isPlaceholderUrl(PNG_1x1)).toBe(false);
    expect(isSupabasePublicUrl(PUBLIC)).toBe(true);
    expect(isSupabasePublicUrl("https://cdn.example/x.png")).toBe(false);
    expect(isSupabasePublicUrl(PNG_1x1)).toBe(false);
  });
  it("builds an id-keyed storage path", () => {
    expect(interiorStoragePath("sl-sofa")).toBe("interior-v1/sl-sofa.png");
    expect(interiorStoragePath("SL Sofa!")).toBe("interior-v1/sl-sofa.png");
  });
});

describe("saveApprovedAssetsToSupabase (V3.7.5)", () => {
  it("uploads a data-URL asset to storage and upserts the DB row", async () => {
    const { deps, uploads, db } = makeDeps();
    const res = await saveApprovedAssetsToSupabase([cand({ id: "sl-a", imageUrl: PNG_1x1 })], deps);
    // uploaded to storage
    expect(uploads).toHaveLength(1);
    expect(uploads[0].id).toBe("sl-a");
    expect(uploads[0].len).toBe(decodeDataUrl(PNG_1x1).bytes.length);
    // DB upsert called with a public url + normalized fields
    expect(db.size).toBe(1);
    const row = db.get("sl-a")!;
    expect(isSupabasePublicUrl(row.imageUrl)).toBe(true);
    expect(row.status).toBe("approved");
    expect(row.source).toBe("style_lab");
    expect(row.modelProvider).toBe("openai");
    expect(row.modelName).toBe("gpt-image-1");
    expect(res).toMatchObject({ saved: 1, uploaded: 1, kept: 0, skipped: 0 });
  });

  it("keeps an existing Supabase public url without re-uploading", async () => {
    const { deps, uploads, db } = makeDeps();
    const res = await saveApprovedAssetsToSupabase([cand({ id: "sl-keep", imageUrl: PUBLIC })], deps);
    expect(uploads).toHaveLength(0);
    expect(res.kept).toBe(1);
    expect(db.get("sl-keep")!.imageUrl).toBe(PUBLIC);
  });

  it("fetches a remote url and uploads it", async () => {
    const bytes = decodeDataUrl(PNG_1x1).bytes;
    const ab = new Uint8Array(bytes).buffer as ArrayBuffer;
    const fetchImpl: FetchLike = async () => ({ ok: true, headers: { get: () => "image/png" }, arrayBuffer: async () => ab });
    const { deps, uploads } = makeDeps({ fetchImpl });
    const res = await saveApprovedAssetsToSupabase([cand({ id: "sl-remote", imageUrl: "https://cdn.example/x.png" })], deps);
    expect(uploads).toHaveLength(1);
    expect(uploads[0].len).toBe(bytes.length);
    expect(res.uploaded).toBe(1);
  });

  it("duplicate save updates the same row (no duplicates)", async () => {
    const { deps, db } = makeDeps();
    await saveApprovedAssetsToSupabase([cand({ id: "sl-dup", name: "v1", imageUrl: PNG_1x1 })], deps);
    await saveApprovedAssetsToSupabase([cand({ id: "sl-dup", name: "v2", imageUrl: PNG_1x1 })], deps);
    expect(db.size).toBe(1);
    expect(db.get("sl-dup")!.name).toBe("v2");
  });

  it("never saves dry-run placeholders or non-OpenAI assets", async () => {
    const { deps, uploads, db } = makeDeps();
    const res = await saveApprovedAssetsToSupabase([
      cand({ id: "sl-ph", imageUrl: "/samples/p.png" }),
      cand({ id: "sl-rep", modelProvider: "replicate", imageUrl: "https://cdn/r.png" }),
    ], deps);
    expect(uploads).toHaveLength(0);
    expect(db.size).toBe(0);
    expect(res).toMatchObject({ saved: 0, skipped: 2 });
  });
});

describe("export uses Supabase-saved assets, not localStorage (V3.7.5)", () => {
  it("excludes seed/non-style_lab candidates from the saved library", () => {
    const seed = cand({ id: "seed-1", source: undefined, slug: "seed", imageUrl: "/samples/cafe-counter.png", modelProvider: "placeholder" });
    const saved = cand({ id: "sl-1", source: "style_lab", slug: "minimalist-sofa", imageUrl: PUBLIC });
    const repoCandidates = [seed, saved];
    const lib = savedFromStyleLab(repoCandidates);
    expect(lib.map((c) => c.id)).toEqual(["sl-1"]);
    const parsed = JSON.parse(exportJson(lib)) as { id: string; imageUrl: string }[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0].imageUrl).toBe(PUBLIC);
    expect(parsed.some((a) => a.imageUrl.startsWith("/samples/"))).toBe(false);
  });

  it("treats not-yet-persisted (localStorage-only) assets as not exported", () => {
    // Repo holds only a seed; the style_lab asset hasn't been saved to Supabase yet.
    const repoCandidates = [cand({ id: "seed-1", source: undefined })];
    const lib = savedFromStyleLab(repoCandidates);
    expect(lib).toHaveLength(0);
    expect(JSON.parse(exportJson(lib))).toHaveLength(0);
  });
});
