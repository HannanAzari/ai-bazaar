import { describe, it, expect } from "vitest";
import {
  GOLDEN_ROOM_SHELL_V1 as PACK,
  localShellImagePath,
  hasUploadedImage,
  resolveShellImageSrc,
  hotspotForArea,
  type RoomShellPackManifest,
} from "@/lib/room-shell-pack";

describe("room-shell-pack manifest (main app)", () => {
  it("is the golden-room-shell-v1 prototype pack from the nestudio-assets bucket", () => {
    expect(PACK.id).toBe("golden-room-shell-v1");
    expect(PACK.type).toBe("room_shell_pack");
    expect(PACK.image.storageBucket).toBe("nestudio-assets");
    expect(PACK.image.storagePath).toBe("room-shells/golden-room-shell-v1/golden-room-shell-v1.png");
  });

  it("exposes the four named scene areas with normalized bounds", () => {
    expect(PACK.sceneAreas.map((a) => a.id)).toEqual([
      "back-wall-main",
      "right-wall-main",
      "floor-center",
      "left-lounge-area",
    ]);
    for (const a of PACK.sceneAreas) {
      for (const v of [a.bounds.x, a.bounds.y, a.bounds.width, a.bounds.height]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("room-shell-pack image source", () => {
  const local = { image: { storagePath: "room-shells/g/g.png", publicUrl: "TO_BE_FILLED_AFTER_UPLOAD" } } as RoomShellPackManifest;
  const up = { image: { storagePath: "room-shells/g/g.png", publicUrl: "https://x.supabase.co/g.png" } } as RoomShellPackManifest;

  it("falls back to the local public path until uploaded, then uses the Supabase URL", () => {
    expect(resolveShellImageSrc(local)).toBe("/room-shells/g/g.png");
    expect(hasUploadedImage(local)).toBe(false);
    expect(resolveShellImageSrc(up)).toBe("https://x.supabase.co/g.png");
    expect(localShellImagePath(local)).toBe("/room-shells/g/g.png");
  });
});

describe("room-shell-pack hotspots", () => {
  it("maps hotspots to scene areas", () => {
    expect(hotspotForArea(PACK, "back-wall-main")?.action).toBe("zoom_to_wall_scene");
    expect(hotspotForArea(PACK, "floor-center")?.action).toBe("open_avatar_or_intro");
    expect(hotspotForArea(PACK, "left-lounge-area")).toBeUndefined();
  });
});
