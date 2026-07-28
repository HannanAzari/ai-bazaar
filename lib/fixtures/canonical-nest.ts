import type { NestDocument } from "@/lib/nest-document-types";

// M23A — ONE deterministic Nest used to prove every surface renders the same composition.
// It deliberately contains every property that used to be lost or approximated:
//
//   • a large object          → exercises the width formula at the top of its range
//   • a small object          → exercises it at the bottom
//   • a rotated object        → rotation must survive
//   • a horizontally flipped object → flipX must survive (it used to be dropped)
//   • two overlapping objects → z-order must be respected
//   • a text overlay          → used to render as nothing outside the editor
//   • an image overlay        → same
//
// Compare this fixture across editor / Profile / Home / Search / full view.
export const CANONICAL_TEST_NEST: NestDocument = {
  id: "canonical-test-nest",
  ownerId: "test-owner",
  backgroundId: "bg-creator-loft",
  title: "Canonical Test Nest",
  visibility: "public",
  createdAt: "2026-07-28T00:00:00.000Z",
  updatedAt: "2026-07-28T00:00:00.000Z",
  placements: [
    // large — a wide sofa low on the floor
    { id: "p-large", assetId: "ast-lr-sofa-boucle", x: 0.32, y: 0.88, scale: 1.1, zIndex: 1 },
    // small — a little table
    { id: "p-small", assetId: "ast-lr-table-oak-round", x: 0.62, y: 0.9, scale: 0.22, zIndex: 2 },
    // rotated
    { id: "p-rotated", assetId: "ast-lr-table-oak-round", x: 0.8, y: 0.86, scale: 0.4, rotation: 18, zIndex: 3 },
    // horizontally flipped
    { id: "p-flipped", assetId: "ast-so-shelf-tall", x: 0.14, y: 0.82, scale: 0.5, flipX: true, zIndex: 4 },
    // overlapping pair — the higher zIndex must paint on top
    { id: "p-under", assetId: "ast-tv", x: 0.5, y: 0.6, scale: 0.6, zIndex: 5 },
    { id: "p-over", assetId: "ast-lr-table-oak-round", x: 0.52, y: 0.62, scale: 0.35, zIndex: 6 },
    // text overlay — box top-left + explicit w/h
    {
      id: "p-text",
      assetId: "overlay:text",
      x: 0.08,
      y: 0.1,
      w: 0.5,
      h: 0.08,
      zIndex: 7,
      overlay: { kind: "text", text: "Welcome home", align: "left" },
    },
    // image overlay
    {
      id: "p-image",
      assetId: "overlay:image",
      x: 0.66,
      y: 0.12,
      w: 0.24,
      h: 0.18,
      rotation: -8,
      zIndex: 8,
      overlay: { kind: "image", src: "data:image/svg+xml;base64,PHN2Zy8+", fit: "contain" },
    },
  ],
};
