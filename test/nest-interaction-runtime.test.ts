import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  describeInteraction,
  interactionForHotspot,
  interactionForPlacement,
  interactionFromBinding,
  interactionProblem,
  safeUrl,
  youTubeEmbedUrl,
  youTubeVideoId,
} from "@/lib/nest-interaction";
import {
  placementFallbackInteraction,
  resolveFocusRegions,
  resolvePlacementHotspots,
  resolvePlacementSurfaces,
} from "@/lib/nest-scene";
import { editableObjectsToPlacements, editableSceneExtras, nestDocumentToEditable } from "@/lib/nest-editor-bridge";
import { registerAssetSurfaces } from "@/lib/nest-surface-catalog";
import { sceneHasContent } from "@/lib/nest/supabase-nest-repo";
import { NEST_SCENE_VERSION, type NestDocument, type NestPlacement } from "@/lib/nest-document-types";
import type { EditableNestDocument, EditableNestObject } from "@/lib/nest-editor-types";
import type { NestAssetHotspot } from "@/lib/nest-hotspot-types";

// ── M24E — a Nest is INTERACTIVE, not a background with PNGs on it ───────────
//
// The founder's report: the Focus outline appears but tapping does nothing, objects placed
// inside a Focus are missing everywhere, and Surface content renders but its configured
// YouTube link never runs. Four independent causes, one per section below. The deterministic
// test Nest from the sprint brief is the fixture throughout: one main scene, one Focus
// region, two books inside it, one TV with an image surface and a YouTube tap action.

// ── the fixture ──────────────────────────────────────────────────────────────

const TV = "ast-tv-m24e";
registerAssetSurfaces(TV, [
  { id: "tv-screen", name: "Screen", type: "image", bounds: { x: 0.2, y: 0.11, width: 0.6, height: 0.48 }, acceptedContentTypes: ["uploaded_image"] },
]);

const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

const screenHotspot: NestAssetHotspot = {
  id: "tv-1-screen",
  name: "TV Screen",
  semantic: "video",
  shape: { type: "rect", x: 0.2, y: 0.11, width: 0.6, height: 0.48 },
  enabled: true,
  authoringMode: "predefined",
  binding: { type: "video", url: YT, label: "My channel" },
};

const book = (n: number): EditableNestObject => ({
  instanceId: `book-${n}`,
  assetId: "ast-book",
  x: 0.2 + n * 0.2,
  y: 0.4,
  width: 0.12,
  height: 0.2,
  anchor: { x: 0.26 + n * 0.2, y: 0.6 },
  plane: "floor",
  zIndex: n,
});

/** The creator's editor state: main scene + one Focus region with two books inside it. */
const editorDoc = (): EditableNestDocument =>
  ({
    id: "nest-1",
    name: "Test Nest",
    backgroundId: "bg-creator-loft",
    backgroundImageUrl: "/nests/library-v1/bg-creator-loft.webp",
    aspectRatio: "3:4",
    objects: [
      {
        instanceId: "tv-1",
        assetId: TV,
        x: 0.22, y: 0.28, width: 0.62, height: 0.3,
        anchor: { x: 0.53, y: 0.58 },
        plane: "floor",
        zIndex: 2,
        hotspots: [screenHotspot],
        surfaces: { "tv-screen": { kind: "image", src: "data:image/png;base64,iVBORw0KGgo=", fit: "cover" } },
      } as EditableNestObject,
    ],
    focusAreas: [
      {
        id: "focus-1",
        name: "The shelf",
        sourceSceneId: "nest-1",
        targetSceneId: "scene-1",
        childSceneId: "scene-1",
        bounds: { x: 0.3, y: 0.2, width: 0.3, height: 0.3 },
        focusBounds: { x: 0.3, y: 0.2, width: 0.3, height: 0.3 },
        trigger: "tap",
        transition: "fade_zoom",
        enabled: true,
      },
    ],
    detailScenes: [
      {
        id: "scene-1",
        name: "The shelf",
        kind: "detail",
        sceneType: "focus",
        parentSceneId: "nest-1",
        parentFocusAreaId: "focus-1",
        viewport: { aspectRatio: "3:4" },
        objects: [book(1), book(2)],
        createdAt: "",
        updatedAt: "",
      },
    ],
  }) as unknown as EditableNestDocument;

/** Stage 2 of the trace: the document the editor bridge produces on save/publish. */
const toCanonical = (ed: EditableNestDocument): NestDocument => ({
  id: "nest-1",
  backgroundId: ed.backgroundId,
  title: ed.name,
  visibility: "public",
  placements: editableObjectsToPlacements(ed.objects),
  scene: editableSceneExtras(ed),
  createdAt: "",
  updatedAt: "",
});

/** Stages 4–7: a Supabase round trip. `scene_extras` and `interaction` are jsonb, so the
 *  wire shape is exactly JSON — serialising proves nothing is lost to a class instance. */
const throughSupabase = (d: NestDocument): NestDocument => JSON.parse(JSON.stringify(d));

// ── 1–4. the data survives every stage ───────────────────────────────────────

describe("1–2. Focus regions and their child objects survive editor → document", () => {
  it("the Focus region is in the canonical document", () => {
    const scene = toCanonical(editorDoc()).scene;
    expect(scene?.version).toBe(NEST_SCENE_VERSION);
    expect(scene?.focusAreas?.map((f) => f.id)).toEqual(["focus-1"]);
  });

  it("BOTH books are in the canonical document", () => {
    const scene = toCanonical(editorDoc()).scene;
    expect(scene?.detailScenes?.[0].objects.map((o) => o.instanceId)).toEqual(["book-1", "book-2"]);
  });

  it("the books stay INSIDE the focus scene — never promoted into the main scene", () => {
    const doc = toCanonical(editorDoc());
    expect(doc.placements.map((p) => p.id)).toEqual(["tv-1"]);
  });
});

describe("3. save → reopen preserves the Focus child objects", () => {
  it("both books come back when the editor reopens", () => {
    const reopened = nestDocumentToEditable(throughSupabase(toCanonical(editorDoc())));
    expect(reopened.detailScenes?.[0].objects.map((o) => o.instanceId)).toEqual(["book-1", "book-2"]);
  });

  it("at exactly the same geometry", () => {
    const reopened = nestDocumentToEditable(throughSupabase(toCanonical(editorDoc())));
    const b1 = reopened.detailScenes![0].objects[0];
    expect({ x: b1.x, y: b1.y, width: b1.width, height: b1.height }).toEqual({ x: 0.4, y: 0.4, width: 0.12, height: 0.2 });
  });

  it("survives repeated save/reopen cycles without drifting", () => {
    let doc = toCanonical(editorDoc());
    for (let i = 0; i < 3; i += 1) doc = toCanonical(nestDocumentToEditable(throughSupabase(doc)));
    expect(doc.scene?.detailScenes?.[0].objects).toHaveLength(2);
  });
});

describe("4. publish → hydrate preserves the Focus child objects", () => {
  it("a visitor resolves both books from the published document alone", () => {
    const [focus] = resolveFocusRegions(throughSupabase(toCanonical(editorDoc())));
    expect(focus.objects.map((o) => o.instanceId)).toEqual(["book-1", "book-2"]);
  });
});

// ── 5–6. focus navigation ────────────────────────────────────────────────────

describe("5–6. entering and leaving a Focus", () => {
  const runtime = readFileSync(join(process.cwd(), "components", "nest", "app-shell", "nest-runtime.tsx"), "utf8");

  it("tapping a Focus region runs an enter-focus interaction", () => {
    expect(runtime).toContain('type: "enter-focus"');
    expect(runtime).toContain("setFocusId(i.focusId)");
  });

  it("the focused view renders the focus scene's own objects", () => {
    expect(runtime).toContain("focusObjectsInPaintOrder(activeFocus.objects)");
  });

  it("there is always a way back to the main scene", () => {
    expect(runtime).toContain("Back to the room");
    expect(runtime).toContain("setFocusId(null)");
  });

  it("returning does not reload — it is state, not navigation", () => {
    expect(runtime).not.toContain("window.location.reload");
  });

  it("switching document resets the focus, so nobody is stranded in someone else's room", () => {
    expect(runtime).toContain("}, [doc.id]);");
  });
});

// ── 7–9. surfaces round-trip: geometry, content and the interaction URL ──────

describe("7–9. Surface geometry, content and interaction all round-trip", () => {
  const published = throughSupabase(toCanonical(editorDoc()));
  const tv = published.placements[0];

  it("7. the surface geometry comes from the asset catalogue, object-local", () => {
    const [s] = resolvePlacementSurfaces(tv);
    expect(s.bounds).toEqual({ x: 0.2, y: 0.11, width: 0.6, height: 0.48 });
  });

  it("8. the creator's uploaded image survives", () => {
    const [s] = resolvePlacementSurfaces(tv);
    expect(s.content).toMatchObject({ kind: "image", fit: "cover" });
  });

  it("9. the YouTube URL survives on the hotspot binding", () => {
    expect(tv.interaction?.hotspots?.[0].binding?.url).toBe(YT);
  });

  it("9b. and resolves to a runnable interaction for a visitor", () => {
    const [h] = resolvePlacementHotspots(tv);
    expect(h.interaction).toEqual({ type: "open-youtube", url: YT, videoId: "dQw4w9WgXcQ", label: "My channel" });
  });

  it("visual content and tap action are separate concerns on the same object", () => {
    // The founder's exact symptom was one working and the other not.
    expect(resolvePlacementSurfaces(tv)).toHaveLength(1);
    expect(resolvePlacementHotspots(tv)).toHaveLength(1);
  });
});

// ── 10. tapping a YouTube surface runs the expected action ───────────────────

describe("10. the YouTube action", () => {
  it("recognises watch, youtu.be and embed forms", () => {
    expect(youTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("refuses a malformed id rather than putting it in an iframe src", () => {
    expect(youTubeVideoId("https://youtu.be/../../evil")).toBeNull();
    expect(youTubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });

  it("plays through the no-cookie embed", () => {
    expect(youTubeEmbedUrl("dQw4w9WgXcQ")).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("a non-YouTube link is an ordinary open-url, not a coerced player", () => {
    expect(interactionFromBinding({ type: "website", url: "https://example.com" })).toEqual({
      type: "open-url",
      url: "https://example.com/",
    });
  });

  it("the runtime plays it in place, and hands external links over explicitly", () => {
    // M25 §P6 replaced the immediate `window.open` with an in-room card: an unannounced
    // navigation away from the Nest is exactly the "destroying the room context" the
    // sprint rules out. The visitor still gets a real anchor — just a labelled one.
    const runtime = readFileSync(join(process.cwd(), "components", "nest", "app-shell", "nest-runtime.tsx"), "utf8");
    expect(runtime).toContain("youTubeEmbedUrl");
    expect(runtime).toContain('target="_blank"');
    expect(runtime).toContain('rel="noreferrer noopener"');
    expect(runtime).toContain("Open in a new tab");
  });
});

// ── 11. one runtime ──────────────────────────────────────────────────────────

describe("11. Preview and Visitor use the SAME runtime", () => {
  const editor = readFileSync(join(process.cwd(), "components", "nest", "editor", "nest-editor.tsx"), "utf8");
  const visitor = readFileSync(join(process.cwd(), "app", "nest", "[slug]", "visitor-client.tsx"), "utf8");

  it("both mount NestRuntime", () => {
    expect(editor).toContain("<NestRuntime document={previewDoc}");
    expect(visitor).toContain("<NestRuntime document={doc}");
  });

  it("they differ only in `mode` — never in composition", () => {
    expect(editor).toContain('mode="editor-preview"');
    expect(visitor).toContain('mode="visitor"');
  });

  it("there is exactly one runtime implementation", () => {
    // NestPreview is an adapter now; it must contain no rendering of its own.
    const preview = readFileSync(join(process.cwd(), "components", "nest", "app-shell", "nest-preview.tsx"), "utf8");
    expect(preview).toContain("<NestRuntime");
    expect(preview).not.toContain("placementStyle");
    expect(preview).not.toContain("resolveFocusRegions");
  });

  it("interaction is the ONLY thing mode decides", () => {
    const runtime = readFileSync(join(process.cwd(), "components", "nest", "app-shell", "nest-runtime.tsx"), "utf8");
    expect(runtime).toContain('const interactive = mode !== "card";');
  });
});

// ── 12–13. draft and publish rules ───────────────────────────────────────────

describe("12–13. draft and publish", () => {
  const mount = readFileSync(join(process.cwd(), "app", "nest-editor", "nest-editor-mount.tsx"), "utf8");

  it("12. reopening restores the DRAFT's scene, not the published one", () => {
    // The merge dropped `scene`, so a creator's unpublished Focus work vanished on reopen.
    expect(mount).toContain("scene: pendingDraft.scene");
  });

  it("12b. a draft is stored separately from what visitors read", () => {
    const repo = readFileSync(join(process.cwd(), "lib", "nest", "supabase-nest-repo.ts"), "utf8");
    expect(repo).toContain("draft_doc");
    // Visitors resolve from nest_objects; a draft physically cannot leak into that path.
    expect(repo).toContain("visitors read `nest_objects`");
  });

  it("13. publishing promotes the draft's scene to the live row", () => {
    const repo = readFileSync(join(process.cwd(), "lib", "nest", "supabase-nest-repo.ts"), "utf8");
    expect(repo).toContain("scene_extras: draft.scene ?? null");
  });
});

// ── 14. malformed interaction data fails clearly ─────────────────────────────

describe("14. bad interaction data fails visibly instead of disappearing", () => {
  const bad = (over: Partial<NestAssetHotspot>): NestAssetHotspot => ({ ...screenHotspot, ...over });

  it("names a link hotspot that has no URL", () => {
    expect(interactionProblem(bad({ binding: { type: "video" } }))).toMatch(/no URL/);
  });

  it("names an unsafe URL rather than silently ignoring it", () => {
    expect(interactionProblem(bad({ binding: { type: "website", url: "javascript:alert(1)" } }))).toMatch(/unsafe/);
  });

  it("and refuses to execute it", () => {
    expect(interactionForHotspot(bad({ binding: { type: "website", url: "javascript:alert(1)" } }))).toEqual({ type: "none" });
    expect(safeUrl("data:text/html,<script>")).toBeNull();
    expect(safeUrl("  JavaScript:alert(1)")).toBeNull();
  });

  it("still RENDERS the broken region, so the creator can see what to fix", () => {
    const p: NestPlacement = { id: "p", assetId: TV, x: 0, y: 0, interaction: { hotspots: [bad({ binding: { type: "video" } })] } };
    expect(resolvePlacementHotspots(p)).toHaveLength(1);
    expect(resolvePlacementHotspots(p)[0].problem).toBeTruthy();
  });

  it("an unconfigured catalogue hotspot is NOT a tap target", () => {
    // Otherwise an invisible button covers the object and swallows every tap.
    const p: NestPlacement = { id: "p", assetId: TV, x: 0, y: 0, interaction: { hotspots: [bad({ binding: undefined })] } };
    expect(resolvePlacementHotspots(p)).toEqual([]);
  });

  it("a disabled hotspot is never interactive", () => {
    const p: NestPlacement = { id: "p", assetId: TV, x: 0, y: 0, interaction: { hotspots: [bad({ enabled: false })] } };
    expect(resolvePlacementHotspots(p)).toEqual([]);
  });
});

// ── the architectural rule the sprint asked for explicitly ───────────────────

describe("actions come from creator data, never from an asset name", () => {
  it("an asset called `ast-tv` with no binding does nothing", () => {
    expect(placementFallbackInteraction({ id: "p", assetId: "ast-tv", x: 0, y: 0 })).toEqual({ type: "none" });
  });

  it("a bare object link still works for the simple authoring path", () => {
    expect(interactionForPlacement({ id: "p", assetId: "x", x: 0, y: 0, linkUrl: "https://example.com/a" })).toMatchObject({
      type: "open-url",
    });
  });

  it("but a hotspot always wins over an object-wide link", () => {
    // Otherwise the whole room becomes accidentally clickable underneath the region the
    // creator actually drew.
    const p: NestPlacement = {
      id: "p", assetId: TV, x: 0, y: 0,
      linkUrl: "https://example.com/whole-object",
      interaction: { hotspots: [screenHotspot] },
    };
    expect(placementFallbackInteraction(p)).toEqual({ type: "none" });
    expect(resolvePlacementHotspots(p)[0].interaction.type).toBe("open-youtube");
  });

  it("internal actions are legitimate and are not reported as broken", () => {
    const ambience: NestAssetHotspot = { ...screenHotspot, semantic: "ambience", binding: { type: "ambience" } };
    expect(interactionProblem(ambience)).toBeNull();
    expect(interactionForHotspot(ambience)).toEqual({ type: "none" });
  });

  it("describes what a tap will do, for aria-labels", () => {
    expect(describeInteraction({ type: "open-youtube", url: YT, videoId: "x", label: "My channel" })).toBe("Play My channel");
    expect(describeInteraction({ type: "enter-focus", focusId: "f", label: "The shelf" })).toBe("Look closer: The shelf");
  });
});

// ── the migration guard ──────────────────────────────────────────────────────

describe("a missing scene_extras column degrades, but never discards creator work", () => {
  it("recognises a document that actually carries focus content", () => {
    expect(sceneHasContent(toCanonical(editorDoc()).scene)).toBe(true);
    expect(sceneHasContent({ version: NEST_SCENE_VERSION })).toBe(false);
    expect(sceneHasContent(undefined)).toBe(false);
  });

  it("a Nest with no focus regions is unaffected — the feature degrades, the product does not", () => {
    const plain = { ...toCanonical(editorDoc()), scene: { version: NEST_SCENE_VERSION } };
    expect(sceneHasContent(plain.scene)).toBe(false);
  });

  it("the repository refuses the write rather than reporting a false success", () => {
    const repo = readFileSync(join(process.cwd(), "lib", "nest", "supabase-nest-repo.ts"), "utf8");
    expect(repo).toContain("assertSceneStorable(doc.scene");
    expect(repo).toContain("assertSceneStorable(draft.scene");
    expect(repo).toContain("m24e_provision.sql");
  });

  it("the migration is additive and idempotent", () => {
    const sql = readFileSync(join(process.cwd(), "supabase", "provision", "m24e_provision.sql"), "utf8");
    expect(sql).toContain("add column if not exists scene_extras jsonb");
    expect(sql).not.toMatch(/\bdrop\s+(table|column)\b/i);
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
  });
});
