import { describe, it, expect } from "vitest";
import {
  getWallPack,
  wallPackForArea,
  resolveWallImageSrc,
  hasUploadedWallImage,
  localWallImagePath,
  type WallPackManifest,
} from "@/lib/wall-pack";
import { matrix3dForQuad, quadToPixels, type Quad } from "@/lib/wall-projection";

describe("wall-pack manifests", () => {
  it("maps room-shell areas to the right wall packs", () => {
    expect(wallPackForArea("back-wall-main")?.id).toBe("media-wall-v1");
    expect(wallPackForArea("right-wall-main")?.id).toBe("work-wall-v1");
    expect(wallPackForArea("floor-center")).toBeUndefined();
    expect(wallPackForArea("left-lounge-area")).toBeUndefined();
  });

  it("media wall has the five clickable object placeholders", () => {
    const m = getWallPack("media-wall-v1")!;
    expect(m.type).toBe("wall_pack");
    expect(m.image.storageBucket).toBe("nestudio-assets");
    expect(m.objects.map((o) => o.id)).toEqual(["tv-main", "left-frame", "right-frame", "speaker-left", "speaker-right"]);
    expect(getWallPack("media-wall-v1")!.objects[0].recommendedFor).toContain("youtube");
  });

  it("work wall has the five clickable object placeholders", () => {
    const w = getWallPack("work-wall-v1")!;
    expect(w.objects.map((o) => o.id)).toEqual(["laptop-main", "microphone-main", "pinboard-main", "book-feature-1", "book-feature-2"]);
    expect(w.usedFor).toContain("github");
    for (const o of w.objects) {
      for (const v of [o.bounds.x, o.bounds.y, o.bounds.width, o.bounds.height]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("resolves Supabase URL when uploaded, local path otherwise", () => {
    const local = { image: { storagePath: "wall-packs/x/x.png", publicUrl: "TO_BE_FILLED_AFTER_UPLOAD" } } as WallPackManifest;
    const up = { image: { storagePath: "wall-packs/x/x.png", publicUrl: "https://cdn/x.png" } } as WallPackManifest;
    expect(hasUploadedWallImage(local)).toBe(false);
    expect(localWallImagePath(local)).toBe("/wall-packs/x/x.png");
    expect(resolveWallImageSrc(local)).toBe("/wall-packs/x/x.png");
    expect(resolveWallImageSrc(up)).toBe("https://cdn/x.png");
  });
});

describe("wall projection (matrix3d homography)", () => {
  it("returns a matrix3d string", () => {
    const q: Quad = { tl: { x: 10, y: 10 }, tr: { x: 90, y: 20 }, br: { x: 85, y: 95 }, bl: { x: 15, y: 80 } };
    const m = matrix3dForQuad(100, 100, q);
    expect(m.startsWith("matrix3d(")).toBe(true);
    expect(m.split(",")).toHaveLength(16);
    expect(m).not.toContain("NaN");
  });

  it("an identity quad yields an identity-like transform", () => {
    const q: Quad = { tl: { x: 0, y: 0 }, tr: { x: 100, y: 0 }, br: { x: 100, y: 100 }, bl: { x: 0, y: 100 } };
    const nums = matrix3dForQuad(100, 100, q).replace(/matrix3d\(|\)/g, "").split(",").map(Number);
    // identity 4x4 (column-major)
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    nums.forEach((n, i) => expect(Math.abs(n - identity[i])).toBeLessThan(1e-6));
  });

  it("scales normalized quads to pixels", () => {
    const q: Quad = { tl: { x: 0, y: 0 }, tr: { x: 1, y: 0 }, br: { x: 1, y: 1 }, bl: { x: 0, y: 1 } };
    const px = quadToPixels(q, 200, 120);
    expect(px.tr).toEqual({ x: 200, y: 0 });
    expect(px.br).toEqual({ x: 200, y: 120 });
  });
});
