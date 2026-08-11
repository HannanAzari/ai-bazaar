import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addContent,
  contentThumbnail,
  moveContent,
  removeContentAt,
  setActiveContent,
  storedContents,
  withDerivedThumbnail,
} from "@/lib/nest-contents";
import {
  activeContentIndex,
  placementContents,
  resolveConnection,
  resolveContents,
  type AssetInteractionConfig,
  type ConnectedContent,
} from "@/lib/nest-asset-interaction";
import { editableObjectsToPlacements } from "@/lib/nest-editor-bridge";
import { editableObjectDisplayContent, placementDisplayContent } from "@/lib/nest-object-display";
import type { EditableNestObject } from "@/lib/nest-editor-types";

// ── M27B-2 — one object holds a LIST ─────────────────────────────────────────
//
// The legacy single `connection` is still read: every Nest published before this sprint
// carries one. It is normalised to `contents[0]` at ONE boundary (`resolveContents`), so
// nothing downstream learns which shape a document happens to use, and jsonb carries both
// without a destructive migration.

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const panel = read("components", "nest", "editor", "interaction-panel.tsx");

const img = (n: number): ConnectedContent => ({ kind: "image", url: `https://s.test/${n}.jpg`, storagePath: `u/n/o/${n}.jpg` });
const yt = (id: string): ConnectedContent => ({ kind: "youtube", url: `https://www.youtube.com/watch?v=${id}` });

const obj = (assetId: string, assetInteraction: AssetInteractionConfig): EditableNestObject =>
  ({ instanceId: "o1", assetId, x: 0.2, y: 0.2, width: 0.2, height: 0.2,
     anchor: { x: 0.3, y: 0.4 }, plane: "front_wall", zIndex: 3, assetInteraction } as unknown as EditableNestObject);

// ── §1 — legacy compatibility ────────────────────────────────────────────────

describe("§1 — a legacy single connection becomes contents[0]", () => {
  it("resolves through the list boundary", () => {
    const legacy: AssetInteractionConfig = { connection: img(1) };
    expect(resolveContents(legacy, "ast-framed-photo")).toEqual([img(1)]);
    expect(storedContents(legacy)).toEqual([img(1)]);
  });

  it("a legacy document still renders — the whole point of not migrating", () => {
    const [p] = editableObjectsToPlacements([obj("ast-framed-photo", { connection: img(1) })]);
    expect(placementDisplayContent(p, "shown", "runtime")?.src).toBe(img(1).url);
  });

  it("contents WINS when both are present — never two disagreeing answers", () => {
    const both: AssetInteractionConfig = { connection: img(9), contents: [img(1), img(2)] };
    expect(resolveContents(both, "ast-framed-photo").map((c) => c.url)).toEqual([img(1).url, img(2).url]);
  });

  it("editing a legacy object upgrades it and drops the old field", () => {
    const next = addContent({ connection: img(1) }, img(2));
    expect(next.contents?.map((c) => c.url)).toEqual([img(1).url, img(2).url]);
    expect(next.connection).toBeUndefined();
  });

  it("an empty list clears the config rather than leaving contents: []", () => {
    const emptied = removeContentAt({ contents: [img(1)] }, 0);
    expect(emptied.contents).toBeUndefined();
    expect(emptied.activeIndex).toBeUndefined();
  });
});

// ── §2 — multiple items ──────────────────────────────────────────────────────

describe("§2 — a compatible object holds many items, in the creator's order", () => {
  it("adds in order", () => {
    let c: AssetInteractionConfig = {};
    for (const n of [1, 2, 3]) c = addContent(c, img(n));
    expect(c.contents?.map((x) => x.url)).toEqual([1, 2, 3].map((n) => img(n).url));
  });

  it("removes exactly one", () => {
    const c = removeContentAt({ contents: [img(1), img(2), img(3)] }, 1);
    expect(c.contents?.map((x) => x.url)).toEqual([img(1).url, img(3).url]);
  });

  it("reorders", () => {
    const c = moveContent({ contents: [img(1), img(2), img(3)] }, 2, 0);
    expect(c.contents?.map((x) => x.url)).toEqual([img(3).url, img(1).url, img(2).url]);
  });

  it("out-of-range operations are no-ops, not corruption", () => {
    const start: AssetInteractionConfig = { contents: [img(1), img(2)] };
    for (const c of [removeContentAt(start, 9), removeContentAt(start, -1), moveContent(start, 0, 5), moveContent(start, 3, 0)]) {
      expect(c.contents?.map((x) => x.url)).toEqual([img(1).url, img(2).url]);
    }
  });
});

// ── The active item ──────────────────────────────────────────────────────────

describe("the current item survives editing", () => {
  it("defaults to the first", () => {
    expect(activeContentIndex({ contents: [img(1), img(2)] }, 2)).toBe(0);
  });

  it("a stale index clamps rather than blanking the object", () => {
    // A deleted item must never leave an object showing nothing.
    expect(activeContentIndex({ activeIndex: 7 }, 2)).toBe(1);
    expect(activeContentIndex({ activeIndex: -3 }, 2)).toBe(0);
    expect(activeContentIndex({ activeIndex: 1.9 }, 2)).toBe(1);
  });

  it("removing an EARLIER item keeps the same item showing", () => {
    const c = removeContentAt(setActiveContent({ contents: [img(1), img(2), img(3)] }, 2), 0);
    expect(c.contents?.[activeContentIndex(c, c.contents!.length)].url).toBe(img(3).url);
  });

  it("reordering carries the current item with it", () => {
    const c = moveContent(setActiveContent({ contents: [img(1), img(2), img(3)] }, 0), 0, 2);
    expect(c.contents?.[activeContentIndex(c, c.contents!.length)].url).toBe(img(1).url);
  });
});

// ── §4/§5 — the two benchmark objects ────────────────────────────────────────

describe("§4 — a frame with several photos shows the first", () => {
  const cfg: AssetInteractionConfig = { contents: [img(1), img(2), img(3)] };

  it("the first photo is what appears, with no tap", () => {
    const [p] = editableObjectsToPlacements([obj("ast-framed-photo", cfg)]);
    expect(placementDisplayContent(p, "shown", "runtime")?.src).toBe(img(1).url);
  });

  it("all three are stored and ordered", () => {
    const [p] = editableObjectsToPlacements([obj("ast-framed-photo", cfg)]);
    expect(placementContents(p).map((c) => c.url)).toEqual([1, 2, 3].map((n) => img(n).url));
  });
});

describe("§5 — a TV with several videos", () => {
  const cfg: AssetInteractionConfig = { contents: [yt("aaaaaaaaaaa"), yt("bbbbbbbbbbb")] };

  it("each entry resolves its own thumbnail", () => {
    const [p] = editableObjectsToPlacements([obj("ast-tv", cfg)]);
    expect(placementContents(p).map((c) => c.thumbnailUrl)).toEqual([
      "https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg",
      "https://i.ytimg.com/vi/bbbbbbbbbbb/hqdefault.jpg",
    ]);
  });

  it("the thumbnail is STORED at add time, not recomputed on every read", () => {
    expect(addContent({}, yt("ccccccccccc")).contents?.[0].thumbnailUrl).toBe("https://i.ytimg.com/vi/ccccccccccc/hqdefault.jpg");
    expect(withDerivedThumbnail(yt("ddddddddddd")).thumbnailUrl).toContain("i.ytimg.com");
  });

  it("a creator-supplied thumbnail is never overwritten", () => {
    expect(withDerivedThumbnail({ ...yt("x"), thumbnailUrl: "https://s.test/mine.jpg" }).thumbnailUrl).toBe("https://s.test/mine.jpg");
  });

  it("the first item is the current content", () => {
    const [p] = editableObjectsToPlacements([obj("ast-tv", cfg)]);
    expect(placementDisplayContent(p, "on", "runtime")?.src).toContain("aaaaaaaaaaa");
  });

  it("an unusable entry is dropped rather than leaving a hole", () => {
    const withBad: AssetInteractionConfig = { contents: [{ kind: "youtube", url: "https://youtube.com/watch?v=" }, yt("eeeeeeeeeee")] };
    const [p] = editableObjectsToPlacements([obj("ast-tv", withBad)]);
    expect(placementContents(p)).toHaveLength(1);
    expect(placementDisplayContent(p, "on", "runtime")?.src).toContain("eeeeeeeeeee");
  });
});

// ── §6/§7 — round trip and one resolver ──────────────────────────────────────

describe("§6/§7 — publish keeps the list, and everyone reads the same current item", () => {
  it("the whole list and its order survive the publish conversion", () => {
    const cfg: AssetInteractionConfig = { contents: [img(1), img(2), img(3)], activeIndex: 1 };
    const [p] = editableObjectsToPlacements([obj("ast-framed-photo", cfg)]);
    expect(p.interaction?.asset?.contents?.map((c) => c.url)).toEqual([1, 2, 3].map((n) => img(n).url));
    expect(p.interaction?.asset?.activeIndex).toBe(1);
  });

  it("editor and runtime resolve the SAME current item", () => {
    const o = obj("ast-framed-photo", { contents: [img(1), img(2)], activeIndex: 1 });
    const [p] = editableObjectsToPlacements([o]);
    expect(editableObjectDisplayContent(o)).toEqual(placementDisplayContent(p, "shown", "runtime"));
    expect(placementDisplayContent(p, "shown", "runtime")?.src).toBe(img(2).url);
  });

  it("resolveConnection still answers 'the current item' — its callers were untouched", () => {
    const [p] = editableObjectsToPlacements([obj("ast-tv", { contents: [yt("fffffffffff"), yt("ggggggggggg")], activeIndex: 1 })]);
    expect(resolveConnection(p)?.url).toContain("ggggggggggg");
  });

  it("no inline media is introduced", async () => {
    const { assertNoInlineMedia } = await import("@/lib/nest-media");
    const [p] = editableObjectsToPlacements([obj("ast-framed-photo", { contents: [img(1), img(2)] })]);
    expect(() => assertNoInlineMedia(p, "publish")).not.toThrow();
  });
});

// ── §3 — the Connect manager ─────────────────────────────────────────────────

describe("§3 — Connect is a content manager", () => {
  it("renders a list, not a single card", () => {
    expect(panel).toContain("const items = storedContents(cfg);");
    expect(panel).toContain("items.map((item, i) =>");
    expect(panel).toContain("function ContentRow(");
  });

  it("adding APPENDS rather than replacing", () => {
    expect(panel).toContain("onCommit(addContent(cfg, next));");
    expect(panel).toContain("onCommit(addContent(cfg, { kind, url: ref.url, storagePath: ref.storagePath");
  });

  it("each row can be removed and reordered", () => {
    expect(panel).toContain("put(removeContentAt(cfg, i))");
    expect(panel).toContain("put(moveContent(cfg, i, i + d))");
    expect(panel).toContain('aria-label="Move up"');
    expect(panel).toContain('aria-label="Move down"');
  });

  it("removing an item removes its storage object too", () => {
    expect(panel).toContain("if (path) void removeNestMedia(path);");
  });

  it("the thumbnail is the item's identity", () => {
    expect(panel).toContain("const thumb = contentThumbnail(item);");
  });

  it("NEVER prints base64, a storage path or a full URL", () => {
    const row = panel.slice(panel.indexOf("function ContentRow"));
    expect(row).not.toMatch(/\{item\.url\}/); // never the raw URL as content
    expect(row).not.toContain("{item.storagePath}");
    expect(row).toContain('shortSourceLabel(item.url ?? "")');
    expect(row).toContain("truncate");
  });

  it("a photo list is labelled Photos and a video list Playlist", () => {
    expect(panel).toContain('def.accepts.includes("youtube") ? "Playlist" : "Photos"');
  });
});

describe("thumbnails for the list", () => {
  it("an image is its own thumbnail", () => {
    expect(contentThumbnail(img(1))).toBe(img(1).url);
  });

  it("a YouTube item derives one even if it was stored without", () => {
    expect(contentThumbnail(yt("hhhhhhhhhhh"))).toBe("https://i.ytimg.com/vi/hhhhhhhhhhh/hqdefault.jpg");
  });

  it("a website has none, and says so rather than guessing", () => {
    expect(contentThumbnail({ kind: "website", url: "https://example.com" })).toBeNull();
  });
});
