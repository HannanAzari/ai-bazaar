// ── Nestudio Production Library — seed fixture (M10) ─────────────────────────
//
// The default curated library. Backgrounds are the camera-DNA persona rooms +
// two M9 stages; assets are the M9 P0 objects (selected candidates); templates are
// the four launch personas. Image URLs point at real files already on disk under
// public/nests/. Statuses are deliberately varied so admin curation + onboarding
// visibility filtering are demonstrable (draft/hidden items must NOT reach onboarding).

import type {
  ProductionAsset,
  ProductionBackground,
  ProductionLibrary,
  ProductionTemplate,
} from "@/lib/nest-production-types";

export const CAMERA_DNA_LOCK_V1 = "camera-dna-lock-v1";

// Deployable, web-optimized library art committed under public/nests/library-v1/ so
// onboarding renders on Vercel (the source candidate art is gitignored / not deployed).
// In Supabase mode these also serve as the per-item fallback when a DB row lacks an
// image URL (see lib/nest-production-library.ts hydrateLibrary).
const LIB = "/nests/library-v1";
const bgMaster = (id: string) => `${LIB}/backgrounds/${id}.webp`;
const assetImg = (id: string) => `${LIB}/assets/${id}.webp`;

// ── Backgrounds ──────────────────────────────────────────────────────────────
const BACKGROUNDS: ProductionBackground[] = [
  {
    id: "bg-creator-loft", name: "Creator Loft", style: "Loft · concrete & brick",
    imageUrl: bgMaster("bg-creator-loft"), variants: { standard: bgMaster("bg-creator-loft") },
    cameraDnaVersion: CAMERA_DNA_LOCK_V1, status: "featured",
    tags: ["creator", "loft", "industrial"], sourceCandidateId: "bg-creator-loft/c1",
  },
  {
    id: "bg-writer-nook", name: "Writer's Nook", style: "Study · walnut & books",
    imageUrl: bgMaster("bg-writer-nook"), variants: { standard: bgMaster("bg-writer-nook") },
    cameraDnaVersion: CAMERA_DNA_LOCK_V1, status: "approved",
    tags: ["writer", "reading", "cozy"], sourceCandidateId: "bg-writer-nook/c1",
  },
  {
    id: "bg-gamer-cave", name: "Gamer Cave", style: "Gamer · dark & RGB",
    imageUrl: bgMaster("bg-gamer-cave"), variants: { standard: bgMaster("bg-gamer-cave") },
    cameraDnaVersion: CAMERA_DNA_LOCK_V1, status: "approved",
    tags: ["gamer", "rgb", "moody"], sourceCandidateId: "bg-gamer-cave/c1",
  },
  {
    id: "bg-minimal-zen", name: "Minimal Zen", style: "Zen · stone & plaster",
    imageUrl: bgMaster("bg-minimal-zen"), variants: { standard: bgMaster("bg-minimal-zen") },
    cameraDnaVersion: CAMERA_DNA_LOCK_V1, status: "approved",
    tags: ["zen", "minimal", "calm"], sourceCandidateId: "bg-minimal-zen/c1",
  },
  {
    id: "bg-outdoor-balcony", name: "Outdoor Balcony", style: "Balcony · decking & sky",
    imageUrl: bgMaster("bg-outdoor-balcony"), variants: { standard: bgMaster("bg-outdoor-balcony") },
    cameraDnaVersion: CAMERA_DNA_LOCK_V1, status: "draft", // not yet curated → hidden from onboarding
    tags: ["outdoor", "balcony"], sourceCandidateId: "bg-outdoor-balcony/c1",
  },
  {
    id: "bg-warm-studio", name: "Warm Studio", style: "Living · warm plaster",
    imageUrl: bgMaster("bg-warm-studio"), variants: { standard: bgMaster("bg-warm-studio") },
    cameraDnaVersion: "front-facing-v1", status: "approved",
    tags: ["living-room", "warm"], sourceCandidateId: "bg-lr-warm-studio/c3",
  },
  {
    id: "bg-focused-office", name: "Focused Office", style: "Office · olive calm",
    imageUrl: bgMaster("bg-focused-office"), variants: { standard: bgMaster("bg-focused-office") },
    cameraDnaVersion: "front-facing-v1", status: "hidden", // withheld → hidden from onboarding
    tags: ["office", "focus"], sourceCandidateId: "bg-so-focused-office/c2",
  },
];

// ── Assets (M9 P0 selected candidates) ───────────────────────────────────────
function asset(
  p: Pick<ProductionAsset, "id" | "name" | "category" | "compatibleSlotTypes" | "tags" | "status"> & {
    c: string; aspect: string; editableSurfaces?: ProductionAsset["editableSurfaces"]; hotspots?: ProductionAsset["hotspots"];
    cameraDnaVersion?: string;
  },
): ProductionAsset {
  const url = assetImg(p.id);
  return {
    id: p.id, name: p.name, category: p.category,
    imageUrl: url, cutoutUrl: url,
    variants: { standard: url },
    visualBounds: { aspect: p.aspect, anchor: { x: 0.5, y: 1 } },
    compatibleSlotTypes: p.compatibleSlotTypes,
    editableSurfaces: p.editableSurfaces,
    hotspots: p.hotspots,
    cameraDnaVersion: p.cameraDnaVersion ?? "front-facing-v1",
    status: p.status, tags: p.tags, sourceCandidateId: `${p.id}/${p.c}`,
  };
}

const ASSETS: ProductionAsset[] = [
  asset({ id: "ast-lr-sofa-boucle", name: "Bouclé Sofa", category: "furniture", compatibleSlotTypes: ["seat"], c: "c2", aspect: "16:9", tags: ["sofa", "seating"], status: "approved" }),
  // M13 (Task 8): angled TV screen — hidden (still resolvable by id for old Nests).
  // The clean front-facing `ast-tv` (below) replaces it in the tray + templates.
  asset({ id: "ast-lr-media-oak-console", name: "Oak Media Console", category: "electronics", compatibleSlotTypes: ["media"], c: "c3", aspect: "16:10", tags: ["tv", "media"], status: "hidden",
    editableSurfaces: [{ id: "surf-screen", label: "TV screen", kind: "screen", bounds: { x: 0.18, y: 0.05, width: 0.64, height: 0.5 }, contentType: "video", aspect: "16:9" }] }),
  asset({ id: "ast-lr-table-oak-round", name: "Oak Coffee Table", category: "furniture", compatibleSlotTypes: ["table"], c: "c1", aspect: "4:3", tags: ["coffee table"], status: "approved" }),
  // M13 (Task 8): off-perspective / low desk — hidden. Replaced by the golden `ast-desk`.
  asset({ id: "ast-so-desk-oak", name: "Oak Desk", category: "furniture", compatibleSlotTypes: ["desk"], c: "c2", aspect: "3:2", tags: ["desk", "work"], status: "hidden" }),
  // M13 (Task 8): green lever + armrest artifacts — hidden. No clean chair in V1;
  // the writer/gamer templates drop the chair for now (desk stands alone).
  asset({ id: "ast-so-chair-task", name: "Task Chair", category: "furniture", compatibleSlotTypes: ["seat"], c: "c2", aspect: "3:4", tags: ["chair", "seating"], status: "hidden" }),
  asset({ id: "ast-so-shelf-tall", name: "Tall Bookshelf", category: "furniture", compatibleSlotTypes: ["shelf"], c: "c3", aspect: "1:2", tags: ["bookshelf", "storage"], status: "approved" }),
  asset({ id: "ast-lr-frame-portrait", name: "Photo Frame", category: "decor", compatibleSlotTypes: ["frame"], c: "c3", aspect: "3:4", tags: ["frame", "photo"], status: "draft",
    editableSurfaces: [{ id: "surf-photo", label: "Photo", kind: "photo", bounds: { x: 0.12, y: 0.1, width: 0.76, height: 0.7 }, contentType: "gallery", aspect: "3:4" }] }),

  // ── Restored Golden Nest assets (M13 · Task 1) ──────────────────────────────
  // Approved front-facing cut-outs (public/nests/library-v1/assets/<id>.webp, built by
  // scripts/build-library-golden-art.mjs from the golden-nest-v1 cut-outs). Their ids
  // match the hotspot catalog (lib/nest-hotspot-catalog.ts) and surface catalog
  // (lib/nest-surface-catalog.ts), so Connect hotspots + editable Surfaces light up by
  // id with no per-asset metadata. `aspect` is the cut-out's true pixel aspect so
  // template placements size correctly.
  asset({ id: "ast-tv", name: "Media Unit", category: "electronics", compatibleSlotTypes: ["media"], c: "golden-v2", aspect: "1489:962", tags: ["tv", "media", "screen"], status: "featured" }),
  asset({ id: "ast-framed-photo", name: "Framed Photo", category: "decor", compatibleSlotTypes: ["frame"], c: "golden-v2", aspect: "843:814", tags: ["frame", "photo", "gallery"], status: "approved" }),
  asset({ id: "ast-floor-lamp", name: "Floor Lamp", category: "lighting", compatibleSlotTypes: ["lamp"], c: "golden-v2", aspect: "436:1510", tags: ["lamp", "lighting"], status: "approved" }),
  asset({ id: "ast-side-plant", name: "Potted Plant", category: "plant", compatibleSlotTypes: ["plant"], c: "golden-v2", aspect: "828:1155", tags: ["plant", "greenery"], status: "approved" }),
  asset({ id: "ast-avatar", name: "Creator Avatar", category: "avatar", compatibleSlotTypes: ["avatar"], c: "golden-v2", aspect: "672:1639", tags: ["avatar", "creator"], status: "approved" }),
  asset({ id: "ast-desk", name: "Writing Desk", category: "furniture", compatibleSlotTypes: ["desk"], c: "golden-v2", aspect: "1149:1015", tags: ["desk", "work"], status: "featured" }),
  asset({ id: "ast-stacked-books", name: "Stacked Books", category: "decor", compatibleSlotTypes: ["books"], c: "golden-v2", aspect: "1119:640", tags: ["books", "reading"], status: "approved" }),
  asset({ id: "ast-bookshelf", name: "Bookshelf", category: "furniture", compatibleSlotTypes: ["shelf"], c: "golden-v2", aspect: "535:1499", tags: ["bookshelf", "storage", "shelf"], status: "approved" }),
];

// ── Templates (four launch personas) ─────────────────────────────────────────
const TEMPLATES: ProductionTemplate[] = [
  {
    id: "tpl-creator-loft", name: "Creator Loft", persona: "Creator", backgroundId: "bg-creator-loft",
    previewImage: bgMaster("bg-creator-loft"), status: "featured", tags: ["creator", "loft"],
    objectPlacements: [
      { assetId: "ast-tv", slotType: "media", x: 0.5, y: 0.56, scale: 0.78, zIndex: 2 },
      { assetId: "ast-lr-sofa-boucle", slotType: "seat", x: 0.36, y: 0.84, scale: 0.62, zIndex: 3 },
      { assetId: "ast-lr-table-oak-round", slotType: "table", x: 0.56, y: 0.92, scale: 0.3, zIndex: 4 },
      { assetId: "ast-so-shelf-tall", slotType: "shelf", x: 0.86, y: 0.7, scale: 0.95, zIndex: 3 },
    ],
  },
  {
    id: "tpl-gamer-cave", name: "Gamer Cave", persona: "Gamer", backgroundId: "bg-gamer-cave",
    previewImage: bgMaster("bg-gamer-cave"), status: "approved", tags: ["gamer"],
    objectPlacements: [
      { assetId: "ast-desk", slotType: "desk", x: 0.5, y: 0.86, scale: 0.5, zIndex: 3 },
      { assetId: "ast-tv", slotType: "media", x: 0.78, y: 0.58, scale: 0.7, zIndex: 2 },
    ],
  },
  {
    id: "tpl-writer-nook", name: "Writer's Nook", persona: "Writer", backgroundId: "bg-writer-nook",
    previewImage: bgMaster("bg-writer-nook"), status: "approved", tags: ["writer", "reading"],
    objectPlacements: [
      { assetId: "ast-desk", slotType: "desk", x: 0.45, y: 0.86, scale: 0.5, zIndex: 3 },
      { assetId: "ast-so-shelf-tall", slotType: "shelf", x: 0.83, y: 0.68, scale: 0.95, zIndex: 2 },
    ],
  },
  {
    id: "tpl-minimal-zen", name: "Minimal Zen", persona: "Minimalist", backgroundId: "bg-minimal-zen",
    previewImage: bgMaster("bg-minimal-zen"), status: "approved", tags: ["zen", "minimal"],
    objectPlacements: [
      { assetId: "ast-lr-sofa-boucle", slotType: "seat", x: 0.5, y: 0.85, scale: 0.62, zIndex: 3 },
      { assetId: "ast-lr-table-oak-round", slotType: "table", x: 0.5, y: 0.93, scale: 0.3, zIndex: 4 },
    ],
  },
];

export const NEST_PRODUCTION_LIBRARY_V1: ProductionLibrary = {
  backgrounds: BACKGROUNDS,
  assets: ASSETS,
  templates: TEMPLATES,
};
