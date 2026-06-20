import { describe, it, expect, afterAll } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { saveApprovedAssets, type FetchLike } from "@/lib/asset-persist-server";
import {
  mergeCatalog,
  assetFileName,
  isPlaceholderUrl,
  decodeDataUrl,
  GENERATED_DIR,
  CATALOG_DIR,
  CATALOG_FILE,
} from "@/lib/asset-persist";
import { type RoomEngineAsset } from "@/lib/export";

// 1x1 transparent PNG.
const PNG_1x1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function asset(over: Partial<RoomEngineAsset> = {}): RoomEngineAsset {
  return {
    id: "ast-x", name: "X", category: "furniture", villageTheme: "any", placement: "floor",
    ownerType: "system", rarity: "common", tags: ["x"], imageUrl: PNG_1x1, status: "published",
    compatibleZones: ["floor_center"], defaultScale: 1, defaultActionType: "none",
    personality: "Minimalist", source: "style_lab", modelProvider: "openai", modelName: "gpt-image-1",
    ...over,
  };
}

const tmpRoots: string[] = [];
async function tmpPublic(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "af-persist-"));
  tmpRoots.push(root);
  return path.join(root, "public");
}
async function readCatalog(pub: string): Promise<RoomEngineAsset[]> {
  return JSON.parse(await fs.readFile(path.join(pub, CATALOG_DIR, CATALOG_FILE), "utf8"));
}
afterAll(async () => { for (const r of tmpRoots) await fs.rm(r, { recursive: true, force: true }); });

describe("asset persistence pure helpers (V3.7.4)", () => {
  it("derives a safe filename from slug or id", () => {
    expect(assetFileName({ id: "ast-sofa", slug: "Minimalist Sofa!" })).toBe("minimalist-sofa.png");
    expect(assetFileName({ id: "ast-sofa-123" })).toBe("ast-sofa-123.png");
  });
  it("flags dry-run placeholder urls", () => {
    expect(isPlaceholderUrl("/samples/x.png")).toBe(true);
    expect(isPlaceholderUrl("https://o/x.png")).toBe(false);
  });
  it("decodes data urls", () => {
    expect(decodeDataUrl(PNG_1x1)!.length).toBeGreaterThan(0);
    expect(decodeDataUrl("https://o/x.png")).toBeNull();
  });
  it("merges + dedupes catalog by id and imageUrl", () => {
    const a = asset({ id: "ast-a", imageUrl: "/generated/interior-v1/a.png" });
    const b = asset({ id: "ast-b", imageUrl: "/generated/interior-v1/b.png" });
    const aDup = asset({ id: "ast-a", name: "A2", imageUrl: "/generated/interior-v1/a.png" });
    const merged = mergeCatalog([a], [b, aDup]);
    expect(merged).toHaveLength(2);
    expect(merged.find((x) => x.id === "ast-a")!.name).toBe("A2"); // incoming wins
  });
});

describe("saveApprovedAssets — filesystem (V3.7.4)", () => {
  it("writes a data-URL asset as a PNG and rewrites imageUrl to a local path", async () => {
    const pub = await tmpPublic();
    const res = await saveApprovedAssets([asset({ id: "ast-sofa", imageUrl: PNG_1x1 })], { publicDir: pub });
    expect(res.saved).toBe(1);
    expect(res.skipped).toBe(0);
    const buf = await fs.readFile(path.join(pub, GENERATED_DIR, "ast-sofa.png"));
    expect(buf.equals(decodeDataUrl(PNG_1x1)!)).toBe(true);
    expect(res.assets[0].imageUrl).toBe("/generated/interior-v1/ast-sofa.png");
  });

  it("writes the catalog JSON with local image paths", async () => {
    const pub = await tmpPublic();
    await saveApprovedAssets([asset({ id: "ast-sofa", imageUrl: PNG_1x1 })], { publicDir: pub });
    const cat = await readCatalog(pub);
    expect(cat).toHaveLength(1);
    expect(cat[0].imageUrl).toBe("/generated/interior-v1/ast-sofa.png");
    expect(cat[0].source).toBe("style_lab");
    expect(cat[0].modelProvider).toBe("openai");
    expect(cat.every((a) => a.imageUrl.startsWith("/generated/interior-v1/"))).toBe(true);
  });

  it("merges into an existing catalog and dedupes by id", async () => {
    const pub = await tmpPublic();
    await saveApprovedAssets([asset({ id: "ast-a", imageUrl: PNG_1x1 })], { publicDir: pub });
    await saveApprovedAssets([asset({ id: "ast-b", imageUrl: PNG_1x1 })], { publicDir: pub });
    let cat = await readCatalog(pub);
    expect(cat.map((c) => c.id).sort()).toEqual(["ast-a", "ast-b"]);
    // re-save ast-a → updates, no duplicate
    await saveApprovedAssets([asset({ id: "ast-a", name: "A-updated", imageUrl: PNG_1x1 })], { publicDir: pub });
    cat = await readCatalog(pub);
    expect(cat).toHaveLength(2);
    expect(cat.find((c) => c.id === "ast-a")!.name).toBe("A-updated");
  });

  it("never saves dry-run /samples placeholders", async () => {
    const pub = await tmpPublic();
    const res = await saveApprovedAssets([asset({ id: "ast-dry", imageUrl: "/samples/x.png" })], { publicDir: pub });
    expect(res.saved).toBe(0);
    expect(res.skipped).toBe(1);
    expect(await readCatalog(pub)).toHaveLength(0);
    await expect(fs.access(path.join(pub, GENERATED_DIR, "ast-dry.png"))).rejects.toBeTruthy();
  });

  it("fetches a remote image and saves it as PNG", async () => {
    const pub = await tmpPublic();
    const bytes = decodeDataUrl(PNG_1x1)!;
    const ab = new Uint8Array(bytes).buffer as ArrayBuffer;
    const fetchImpl: FetchLike = async () => ({ ok: true, arrayBuffer: async () => ab });
    const res = await saveApprovedAssets([asset({ id: "ast-remote", imageUrl: "https://cdn.example/x.png" })], { publicDir: pub, fetchImpl });
    expect(res.saved).toBe(1);
    const buf = await fs.readFile(path.join(pub, GENERATED_DIR, "ast-remote.png"));
    expect(buf.length).toBe(bytes.length);
  });

  it("keeps an already-local generated url without refetching", async () => {
    const pub = await tmpPublic();
    const res = await saveApprovedAssets([asset({ id: "ast-keep", imageUrl: "/generated/interior-v1/ast-keep.png" })], { publicDir: pub });
    expect(res.saved).toBe(1);
    expect(res.assets[0].imageUrl).toBe("/generated/interior-v1/ast-keep.png");
  });

  it("returns counts for a mixed batch (real + placeholder)", async () => {
    const pub = await tmpPublic();
    const res = await saveApprovedAssets([
      asset({ id: "ast-real", imageUrl: PNG_1x1 }),
      asset({ id: "ast-ph", imageUrl: "/samples/p.png" }),
    ], { publicDir: pub });
    expect(res.saved).toBe(1);
    expect(res.skipped).toBe(1);
    expect(res.catalogCount).toBe(1);
  });
});
