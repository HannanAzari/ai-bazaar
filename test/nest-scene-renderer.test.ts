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

const runtime = read("components", "nest", "app-shell", "nest-runtime.tsx");
const adapter = read("components", "nest", "app-shell", "nest-preview.tsx");
const editor = read("components", "nest", "editor", "nest-editor.tsx");
const visitor = read("app", "nest", "[slug]", "visitor-client.tsx");
const feed = read("components", "nest", "app-shell", "discovery.tsx");

describe("there is only one renderer", () => {
  it("Preview, the visitor and the feed all instantiate the one runtime", () => {
    // M24E — the editor and the visitor now name NestRuntime directly; the feed still
    // goes through the NestPreview adapter, which is a pure passthrough to the same
    // component (asserted below), so all three really are one implementation.
    expect(editor).toContain("<NestRuntime");
    expect(visitor).toContain("<NestRuntime");
    expect(feed).toContain("<NestPreview");
    expect(adapter).toContain("<NestRuntime");
  });

  it("the NestPreview adapter carries no rendering of its own", () => {
    expect(adapter).not.toContain("placementStyle");
    expect(adapter).not.toContain("resolveFocusRegions");
  });

  it("Preview no longer uses a separate scene navigator", () => {
    // The editor's preview branch used NestSceneNavigator — a third renderer that showed
    // a scene no visitor would ever get.
    const previewBranch = editor.slice(editor.indexOf('{mode === "preview"'), editor.indexOf('{mode === "preview"') + 1800);
    expect(previewBranch).not.toContain("NestSceneNavigator");
    expect(previewBranch).toContain("<NestRuntime");
  });

  it("Preview and the visitor are both fully interactive modes of it", () => {
    // Asserted as properties, not as an exact literal — adding a prop to both surfaces is
    // a legitimate change and should not fail this.
    const previewTag = editor.slice(editor.indexOf("<NestRuntime document={previewDoc}"));
    expect(previewTag.slice(0, 160)).toContain('mode="editor-preview"');
    expect(previewTag.slice(0, 160)).toContain("surround");
    const visitorTag = visitor.slice(visitor.indexOf("<NestRuntime document={doc}"));
    expect(visitorTag.slice(0, 160)).toContain('mode="visitor"');
    expect(visitorTag.slice(0, 160)).toContain("surround");
    // Neither mode may change composition — only input.
    expect(runtime).toContain('const interactive = mode !== "card";');
  });

  it("Preview builds its document with the SAME function publish uses", () => {
    // If these ever diverge, Preview stops predicting what gets published.
    expect(editor).toContain("editableObjectsToPlacements(doc.objects)");
  });
});

describe("one coordinate space", () => {
  it("the stage is locked to the scene aspect, not the container's", () => {
    expect(runtime).toContain("aspectRatio");
    expect(runtime).toContain("cqw");
    expect(runtime).toContain("cqh");
  });

  it("the background fills that stage exactly instead of being cropped", () => {
    // `object-cover` crops, which decoupled the background from the objects. Checked as
    // an applied CLASS, not a mention — the explanatory comment names it deliberately.
    expect(runtime).toContain("size-full object-fill");
    expect(runtime).not.toContain("size-full object-cover");
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
  it("the renderer replays creator-configured interactions itself", () => {
    // Not rebuilt by a visitor-only layer that Preview would never show.
    expect(runtime).toContain("resolvePlacementHotspots");
    expect(runtime).toContain("placementFallbackInteraction");
    expect(runtime).toContain("interactive");
  });

  it("an unresolved asset keeps its footprint instead of vanishing", () => {
    expect(runtime).toContain("placeholder");
  });
});
