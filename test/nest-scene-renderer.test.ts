import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { placementBox, SCENE_ASPECT } from "@/lib/nest-geometry";
import type { NestPlacement } from "@/lib/nest-document-types";

// ── M24B §1 — ONE SceneRenderer, one coordinate space ────────────────────────
//
// "Editor == Preview == Published == Feed == Visitor." Two things have to hold for that
// to be true, and both were broken before M24B:
//
//   1. every surface must instantiate the SAME renderer with the SAME document, and
//   2. the scene must occupy the same coordinate space everywhere — otherwise a
//      percentage resolves to a different point on each screen, which is exactly how the
//      background and the objects drifted apart.

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

const preview = read("components", "nest", "app-shell", "nest-preview.tsx");
const editor = read("components", "nest", "editor", "nest-editor.tsx");
const visitor = read("app", "nest", "[slug]", "visitor-client.tsx");
const feed = read("components", "nest", "app-shell", "discovery.tsx");

describe("there is only one renderer", () => {
  it("Preview, the visitor and the feed all instantiate NestPreview", () => {
    for (const [name, src] of [["editor preview", editor], ["visitor", visitor], ["feed", feed]] as const) {
      expect(name && src.includes("<NestPreview")).toBe(true);
    }
  });

  it("Preview no longer uses a separate scene navigator", () => {
    // The editor's preview branch used NestSceneNavigator — a third renderer that showed
    // a scene no visitor would ever get.
    const previewBranch = editor.slice(editor.indexOf('{mode === "preview"'), editor.indexOf('{mode === "preview"') + 1800);
    expect(previewBranch).not.toContain("NestSceneNavigator");
    expect(previewBranch).toContain("<NestPreview");
  });

  it("Preview and the visitor pass the same interactive flag, so behaviour matches", () => {
    expect(editor).toContain('<NestPreview doc={previewDoc} className="size-full" interactive />');
    expect(visitor).toContain("interactive />");
  });

  it("Preview builds its document with the SAME function publish uses", () => {
    // If these ever diverge, Preview stops predicting what gets published.
    expect(editor).toContain("editableObjectsToPlacements(doc.objects)");
  });
});

describe("one coordinate space", () => {
  it("the stage is locked to the scene aspect, not the container's", () => {
    expect(preview).toContain("aspectRatio");
    expect(preview).toContain("cqw");
    expect(preview).toContain("cqh");
  });

  it("the background fills that stage exactly instead of being cropped", () => {
    // `object-cover` crops, which decoupled the background from the objects. Checked as
    // an applied CLASS, not a mention — the explanatory comment names it deliberately.
    expect(preview).toContain("size-full object-fill");
    expect(preview).not.toContain("size-full object-cover");
  });

  it("the scene aspect is a single shared constant", () => {
    expect(SCENE_ASPECT).toBe(0.75);
  });
});

describe("geometry is replayed, never recomputed", () => {
  const p: NestPlacement = { id: "p1", assetId: "ast-x", x: 0.123, y: 0.456, w: 0.321, h: 0.234, zIndex: 3 };

  it("an explicit box comes back byte-for-byte", () => {
    const box = placementBox(p);
    expect(box.x).toBe(0.123);
    expect(box.y).toBe(0.456);
    expect(box.w).toBe(0.321);
    expect(box.h).toBe(0.234);
  });

  it("is identical no matter what index it is painted at", () => {
    expect(placementBox(p, 0)).toEqual(placementBox(p, 7));
  });

  it("does not consult the asset catalogue for an explicit box", () => {
    // An unknown asset must not change the geometry — that was the worst drift case.
    const unknown = { ...p, assetId: "ast-does-not-exist-anywhere" };
    expect(placementBox(unknown)).toEqual(placementBox(p));
  });
});

describe("interaction parity", () => {
  it("the renderer replays creator-configured links itself", () => {
    // Not rebuilt by a visitor-only layer that Preview would never show.
    expect(preview).toContain("p.linkUrl");
    expect(preview).toContain("interactive");
  });

  it("an unresolved asset keeps its footprint instead of vanishing", () => {
    expect(preview).toContain("placeholder");
  });
});
