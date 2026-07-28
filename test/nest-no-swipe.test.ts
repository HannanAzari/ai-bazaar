import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ── M23B §9 — horizontal Nest swiping is removed, and stays removed ──────────
//
// D-06 was decided long before it was implemented, and drifted back in. This is a source
// assertion rather than a DOM test on purpose: the requirement is that the swipe
// machinery does not EXIST, and the cheapest honest way to check "does not exist" is to
// read the file the founder will actually be using.

const visitorClient = readFileSync(
  join(process.cwd(), "app", "nest", "[slug]", "visitor-client.tsx"),
  "utf8",
);

describe("full Nest view has no Nest-to-Nest swiping", () => {
  it("has no pointer handlers driving navigation", () => {
    expect(visitorClient).not.toContain("onPointerDown");
    expect(visitorClient).not.toContain("onPointerUp");
    expect(visitorClient).not.toContain("onTouchStart");
  });

  it("has no left/right arrow navigation between Nests", () => {
    expect(visitorClient).not.toContain("ChevronLeft");
    expect(visitorClient).not.toContain("ChevronRight");
    expect(visitorClient).not.toContain("ArrowRight");
    expect(visitorClient).not.toContain("ArrowLeft");
  });

  it("has no reel/pagination state", () => {
    // The whole reel module is gone from this screen; the drawer lists siblings instead.
    expect(visitorClient).not.toContain("nest-reel");
    expect(visitorClient).not.toContain("reelNeighbours");
    expect(visitorClient).not.toContain("viewableReel");
  });

  it("has no directional slide transition (it only existed to animate swiping)", () => {
    expect(visitorClient).not.toContain("nest-slide-left");
    expect(visitorClient).not.toContain("nest-slide-right");
  });

  it("no longer overrides touch-action, so browser back-swipe and panning work", () => {
    expect(visitorClient).not.toContain("touchAction");
  });

  it("still reaches other Nests — through the drawer, as real navigation", () => {
    expect(visitorClient).toContain("Published Nests");
    expect(visitorClient).toContain("siblings");
  });

  it("shows the NEST title in the top pill, not the creator's name", () => {
    expect(visitorClient).toContain("{doc.title}</span>");
  });

  it("keeps Like, Comments and Share on the permanent canvas", () => {
    expect(visitorClient).toContain("<LikeButton");
    expect(visitorClient).toContain("<CommentButton");
    expect(visitorClient).toContain("<ShareButton");
  });

  it("moves owner administration off the canvas into a menu", () => {
    expect(visitorClient).toContain("OwnerMenu");
    // No permanently-mounted Edit/Stats/View House row over the artwork.
    expect(visitorClient).not.toContain("OwnerActions");
  });
});
