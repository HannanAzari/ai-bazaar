// ── Nestudio V2 — Golden Nest data contract (M1) ────────────────────────────
//
// The typed contract for the V2 **House → Nest → Objects → Content** architecture
// (ADR-027) with the **front-facing cinematic camera** locked by ADR-028. This is
// the shape future implementation (the Nest Composer, the Asset Library, the
// mobile renderer) will use. It is **purely additive**: it does not touch or
// replace the V1 room engine in `lib/types.ts`. The V1 types (`CatalogAsset`,
// `AssetCategory`, `Room`, `RoomObject`, `VisualTemplate`, …) remain valid and
// untouched; the V2 types here are namespaced (`Nest*`) to avoid any clash.
//
// Nothing here renders, persists, or generates anything yet — M1 is the contract
// only. Masters: docs/nestudio-production-pipeline.md, docs/golden-nest-production-bible.md,
// docs/nest-data-contract.md. Camera: ADR-028. Visual language: docs/nestudio-visual-dna.md.

// ── Locked constants ────────────────────────────────────────────────────────

/** The front-facing cinematic camera contract every V2 template + asset is
 * authored to (ADR-028). Frozen — changing it invalidates the V2 Asset Library. */
export const NEST_CAMERA_CONTRACT_VERSION = "front-facing-v1" as const;

/** The V2 visual-DNA lineage these assets/templates are authored against. This is
 * the front-facing successor to the V1 ~30° iso object DNA (3.7.0, now reference
 * only). Placeholder version until the V2 object DNA is formally re-locked. */
export const CURRENT_NEST_DNA_VERSION = "nestudio-v2-1.0" as const;

// ── Shared primitives ───────────────────────────────────────────────────────

/** A point normalized 0..1 on each axis of the template image. */
export type NestPoint = { x: number; y: number };

/** A rectangle normalized 0..1 on each axis of the template image. (Defined here
 * so the V2 Nest contract is self-contained — independent of V1 `lib/types.ts`.) */
export type NormalizedRect = { x: number; y: number; width: number; height: number };

/**
 * The four mobile-first portrait/landscape aspect ratios a template may declare.
 * Portrait is primary (the Nest fills a phone); landscape variants share the same
 * camera angles (ADR-028).
 */
export type NestAspectRatio = "3:4" | "9:16" | "4:3" | "16:9";

/**
 * The locked depth planes of the front-facing "stage box" (ADR-028 §11). These
 * are the only places an asset may live; a slot encodes exactly one plane.
 */
export type NestPlane =
  | "front_wall" // fronto-parallel main wall (TV, frames, shelves, pinboard)
  | "left_sliver" // gently raked left wall — accent/decor only
  | "right_sliver" // gently raked right wall — accent/decor only
  | "floor" // floor furniture (sofa, desk, rug, plant, avatar)
  | "foreground"; // small near objects for depth

// ── Asset ───────────────────────────────────────────────────────────────────

/**
 * Curated asset categories (production-bible §8). Everything placeable is a
 * library asset built to the locked camera + DNA. `avatar` and `personal` are the
 * two categories that may be generated at runtime; everything else is curated.
 */
export type NestAssetCategory =
  | "furniture" // sofa, armchair, coffee table, desk, bookshelf, bed…
  | "electronics" // TV, speakers, laptop, microphone, console…
  | "lighting" // lamps, fixtures
  | "plant" // greenery
  | "decor" // books, frames, posters, trophies, rugs…
  | "creator_tool" // cameras, keyboards, drawing tablets, easels…
  | "business" // product shelves, artwork, handmade-goods displays…
  | "surface" // a standalone editable-surface skin (a book cover / photo card) — see §NestSurfaceKind
  | "avatar" // the creator's character (runtime-generated)
  | "personal"; // a truly personal belonging (runtime-generated)

/**
 * The asset's production tier (production-bible §9). Drives how much LOD / state /
 * variant investment it carries, and flags the two runtime-generated exceptions.
 */
export type NestAssetType =
  | "hero" // interactive identity-carrier (TV, desk, bookshelf, frame): full LOD + states + variants
  | "standard" // normal curated object
  | "filler" // ambient decor (small plants, stacked books): thumbnail + a couple variants
  | "avatar" // the creator avatar (runtime-generated)
  | "personal_belonging"; // a truly personal item (runtime-generated)

/** Approval state in the curation pipeline (production-bible §15). Humans approve;
 * raw AI never ships. Shared by assets and templates. */
export type NestApprovalStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "retired";

/** Where an asset came from. Only `runtime_avatar` / `runtime_personal` are
 * generated per creator at runtime (within DNA/camera constraints, ADR-027). */
export type NestAssetSource =
  | "curated" // hand-authored / approved into the library
  | "ai_concept" // AI concept art seed, human-approved into the library
  | "runtime_avatar" // generated for one creator (avatar)
  | "runtime_personal" // generated for one creator (personal belonging)
  | "marketplace"; // submitted by a creator / 3rd-party artist (future)

/**
 * A cheap personalization variant (production-bible §9) — color/material/accent,
 * not a new mesh. Each variant may carry its own rendered LOD images.
 */
export type NestAssetVariant = {
  id: string;
  name: string;
  /** One accent colour (hex) — the "one accent per thing" rule. */
  accent?: string;
  /** Material family override (e.g. "walnut", "bouclé"). */
  material?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  transparentPngUrl?: string;
};

/** The visual state names an interactive object can render (production-bible §9). */
export type NestAssetStateName = "idle" | "hover" | "active" | "open";

/** One rendered interaction state (only interactive/hero assets need >1). */
export type NestAssetState = {
  name: NestAssetStateName;
  imageUrl?: string;
  transparentPngUrl?: string;
};

// ── Editable surfaces (Production Pack V1 · M9.1) ─────────────────────────────

/**
 * The kinds of creator-customizable surface a Nest asset can expose (or, for a
 * standalone `surface` asset, the kind it fills). The engine composites content
 * into these regions — a surface is never baked into the object art.
 * - `screen` — TV / laptop / monitor → video / website
 * - `photo` — frame / poster / mini-frame → gallery image
 * - `cover` — book / notebook / sticky note → article
 * - `note-board` — pinboard → hosts note/photo children
 * - `surface-projection` — a flat top (table / desk / shelf) that hosts projected children
 */
export type NestSurfaceKind =
  | "screen"
  | "photo"
  | "cover"
  | "note-board"
  | "surface-projection";

/**
 * A named, creator-customizable region on an asset. `bounds` is the normalized
 * footprint (0..1) on the asset image the engine composites content into; `aspect`
 * is the region's target aspect (e.g. "16:9" for a TV screen). Optional/additive:
 * assets that predate this (V1 golden fixtures) simply omit it.
 */
export type NestEditableSurface = {
  id: string;
  label: string;
  kind: NestSurfaceKind;
  bounds: NormalizedRect;
  /** What binds here (a screen → video/website, a frame → gallery, a cover → article). */
  contentType: NestContentType;
  /** Target aspect of the region, e.g. "16:9" / "3:4". */
  aspect: string;
};

/**
 * A curated reusable object in the Asset Library — the heart of Nestudio. Every
 * asset is authored to the locked front-facing camera + DNA, tagged with the slot
 * types it can fill, and approved before it can be composed into a Nest.
 */
export type NestAsset = {
  id: string;
  name: string;
  category: NestAssetCategory;
  tags: string[];
  /** Visual-DNA version this asset was authored against (e.g. CURRENT_NEST_DNA_VERSION). */
  dnaVersion: string;
  /** Camera contract this asset was authored to — must be the locked front-facing
   * camera to be V2-compatible (ADR-028). */
  cameraContractVersion: string;
  assetType: NestAssetType;
  /** Standard LOD render (the in-Nest image). */
  imageUrl: string;
  /** Tiny simplified LOD for village/discovery cards. */
  thumbnailUrl: string;
  /** Isolated transparent-PNG source (the master, front-facing). */
  transparentPngUrl: string;
  /** Slot types this asset may snap into. */
  compatibleSlotTypes: NestSlotType[];
  /** Default interaction behaviour for this asset (an Interaction id), if any. */
  defaultInteractionId?: string;
  /** Cheap color/material/accent variants (personalization without new meshes). */
  variants: NestAssetVariant[];
  /** Interaction states (idle/hover/open). Empty/[idle] for non-interactive decor. */
  states: NestAssetState[];
  /**
   * Creator-customizable regions this asset exposes (a TV's screen, a frame's
   * photo, a book's cover, a pinboard's board, a desk/table/shelf top). Optional +
   * additive — V1 golden fixtures omit it and render unchanged (Production Pack V1 · M9.1).
   */
  editableSurfaces?: NestEditableSurface[];
  /**
   * Set only when `category === "surface"`: which editable-surface kind this
   * standalone skin fills (a `cover` book-cover skin, a `photo` photo card). This
   * is how the pack models cover/photo skins as **standalone surface assets** rather
   * than `NestAssetVariant`s (Production Pack V1 · M9.1).
   */
  surfaceKind?: NestSurfaceKind;
  approvalStatus: NestApprovalStatus;
  source: NestAssetSource;
  createdAt: string;
  updatedAt: string;
};

// ── SceneSlot ─────────────────────────────────────────────────────────────────

/**
 * The canonical slot taxonomy (production-bible §10, pipeline §6). A Nest Template
 * defines named slots of these types; assets declare which types they fit.
 */
export type NestSlotType =
  | "media"
  | "desk"
  | "shelf"
  | "books"
  | "plant"
  | "window"
  | "avatar"
  | "frame"
  | "lamp"
  | "product"
  // ── Production Pack V1 additions (M9.1) ──────────────────────────────────────
  | "seat" // sofas, armchairs, office/desk chairs (floor plane)
  | "table" // coffee/side tables — surface furniture that is not a work desk (projection parent)
  | "rug" // floor coverings (floor plane, lowest z, no contact shadow)
  | "pinboard"; // wall-mounted note/cork boards that host editable note children

/** A slot's importance (production-bible §10): primary slots drive identity and are
 * expected to be filled; optional slots are ambient/filler. */
export type NestSlotImportance = "primary" | "optional";

/**
 * A named placement region inside a Nest Template. The template author has already
 * solved placement/perspective for the locked camera, so **any compatible asset
 * snapped here looks correct** — this is the consistency guarantee. No free-form
 * pixel placement, ever.
 */
export type SceneSlot = {
  id: string;
  name: string;
  slotType: NestSlotType;
  /** Asset categories this slot accepts (e.g. a media slot accepts electronics). */
  acceptedAssetCategories: NestAssetCategory[];
  /** Footprint region on the template image (normalized 0..1). */
  bounds: NormalizedRect;
  /** Base-centre anchor (normalized 0..1) the asset's base snaps to. */
  anchorPoint: NestPoint;
  /** Paint order (higher = drawn on top / nearer the viewer). */
  zIndex: number;
  /** Which depth plane the slot lives on (ADR-028). */
  plane: NestPlane;
  importance: NestSlotImportance;
  /** Default interaction for assets dropped here (e.g. a media slot → video). */
  defaultInteractionId?: string;
  /**
   * Avatar-relative size reference used when authoring this slot's bounds
   * (avatar height = 1.0). Documentation/calibration metadata, surfaced in the
   * debug overlay. Optional — V1 slots omit it and render unchanged.
   */
  scaleRef?: number;
  /**
   * Draw a soft warm/cool-plum contact shadow beneath this object (floor-standing
   * objects only). Optional — V1 slots omit it (no shadow), so V1 is unchanged.
   */
  contactShadow?: boolean;
  notes?: string;
};

// ── Interaction ───────────────────────────────────────────────────────────────

/** What fires an interaction. Tap is the primary mobile trigger; `auto` is ambient. */
export type NestInteractionTrigger = "tap" | "hover" | "auto";

/**
 * The lightweight animation an interaction plays (production-bible §11). All are
 * transform/opacity-class, reduced-motion-safe.
 */
export type NestAnimation =
  | "glow"
  | "screen_on"
  | "open"
  | "zoom"
  | "pulse"
  | "shine"
  | "light"
  | "leaf_sway"
  | "wave"
  | "none";

/**
 * What an interaction opens (production-bible §11). `ambience` and `none` are the
 * non-content behaviours (lamp toggles ambience; a plant just sways).
 */
export type NestContentType =
  | "video"
  | "website"
  | "article"
  | "gallery"
  | "music"
  | "podcast"
  | "shop"
  | "achievements"
  | "intro"
  | "ambience"
  | "none";

/**
 * A reusable Object → Animation → Content behaviour, keyed by id and inherited by
 * any asset of the matching type (the Interaction Library). Animations are
 * lightweight and reduced-motion-safe.
 */
export type Interaction = {
  id: string;
  name: string;
  trigger: NestInteractionTrigger;
  animation: NestAnimation;
  contentType: NestContentType;
  /** What plays instead under prefers-reduced-motion (usually "none" = instant). */
  reducedMotionFallback: NestAnimation;
  /** Optional sound id (used sparingly). */
  sound?: string;
  notes?: string;
};

// ── NestTemplate ──────────────────────────────────────────────────────────────

/**
 * The shallow "stage box" geometry of the front-facing scene (ADR-028 §11). All
 * regions/seams are normalized 0..1 on the template image.
 */
export type NestSceneBox = {
  /** Fronto-parallel main wall region. */
  frontWall: NormalizedRect;
  /** Gently raked left wall sliver region. */
  leftSliver: NormalizedRect;
  /** Gently raked right wall sliver region. */
  rightSliver: NormalizedRect;
  /** Floor region (slightly up-tilted to meet the front wall). */
  floor: NormalizedRect;
  /** The y-line where the floor meets the front wall. */
  floorSeamY: number;
  /** The camera's gentle downward tilt in degrees (~5–10, ADR-028). */
  cameraTiltDeg: number;
};

/**
 * A global ambience preset (production-bible §7) — a tint/glow layer over the
 * composed Nest. All presets keep the warm-light / cool-shadow law.
 */
export type NestAmbiencePreset = {
  id: string; // e.g. "warm_day", "golden_evening", "cozy_night"
  name: string;
  /** Global tint colour (hex). */
  tint: string;
  /** Warm glow colour (hex). */
  glow: string;
  /** Strength of the ambience layer, 0..1. */
  intensity: number;
};

/**
 * One creator-instance binding of content to a slot (the creator's actual link /
 * media). Kept loose so it can grow without a migration. Used both for a
 * template's suggested defaults and a ComposedNest's real assignments.
 */
export type SlotAssignment = {
  slotId: string;
  assetId: string;
  /** Chosen variant of the asset, if any. */
  variantId?: string;
  /** Interaction override (else the asset/slot default applies). */
  interactionId?: string;
  /** The content this object points to (a YouTube channel, a gallery, …). */
  content?: NestContentBinding;
};

/** The destination an object's interaction opens, bound by the creator. */
export type NestContentBinding = {
  contentType: NestContentType;
  url?: string;
  title?: string;
  /** Free-form extra payload (e.g. gallery image urls), grows without migration. */
  data?: Record<string, string>;
};

/**
 * A curated front-facing cinematic scene template. It is a non-interactive
 * background image (baked ambient room light, an *empty* stage) plus the Scene
 * Slots assets snap into. Authored to the locked camera + DNA; approved before use.
 */
export type NestTemplate = {
  id: string;
  name: string;
  description: string;
  /** Must be the locked front-facing camera (ADR-028). */
  cameraContractVersion: string;
  dnaVersion: string;
  /** The front-facing scene shell image (empty stage, baked ambient light). */
  backgroundImageUrl: string;
  aspectRatio: NestAspectRatio;
  sceneBox: NestSceneBox;
  slots: SceneSlot[];
  ambiencePresets: NestAmbiencePreset[];
  /** Suggested asset per slot (a ready-to-compose starting point). */
  defaultSlotAssignments: SlotAssignment[];
  approvalStatus: NestApprovalStatus;
  createdAt: string;
  updatedAt: string;
};

// ── ComposedNest ──────────────────────────────────────────────────────────────

/** Who can see a creator's Nest. */
export type NestAccessLevel = "public" | "unlisted" | "private";

/**
 * The mandatory flat, accessible, crawlable link list rendered alongside every
 * Nest (carried forward from ADR-024 — SEO/accessibility/"I just want the link").
 */
export type NestQuickLink = {
  id: string;
  label: string;
  url: string;
};

/**
 * One creator's assembled Nest — a lightweight manifest (slot → asset + variant +
 * content), **not** a baked megapixel scene (production-bible §17). The renderer
 * composes the template image + the snapped assets + ambience on device.
 */
export type ComposedNest = {
  id: string;
  ownerId: string;
  houseId: string;
  templateId: string;
  /** The creator's chosen assets-in-slots, with content bindings. */
  slotAssignments: SlotAssignment[];
  /** The avatar asset filling the avatar slot, if generated. */
  avatarAssetId?: string;
  /** A few truly personal belongings (the only runtime-generated objects + avatar). */
  personalAssetIds: string[];
  /** The chosen ambience preset id (must exist on the template). */
  ambiencePresetId: string;
  accessLevel: NestAccessLevel;
  quickLinks: NestQuickLink[];
  createdAt: string;
  updatedAt: string;
};

// ── Pure helpers / validators (small, testable; no I/O) ──────────────────────

/** Every slot type, useful for iteration / exhaustiveness checks. */
export const NEST_SLOT_TYPES: NestSlotType[] = [
  "media",
  "desk",
  "shelf",
  "books",
  "plant",
  "window",
  "avatar",
  "frame",
  "lamp",
  "product",
  // Production Pack V1 additions (M9.1)
  "seat",
  "table",
  "rug",
  "pinboard",
];

/** Find a slot on a template by id. */
export function findSlot(template: NestTemplate, slotId: string): SceneSlot | undefined {
  return template.slots.find((s) => s.id === slotId);
}

/** The template's primary (identity-driving, expected-to-be-filled) slots. */
export function primarySlots(template: NestTemplate): SceneSlot[] {
  return template.slots.filter((s) => s.importance === "primary");
}

/**
 * Whether an asset may snap into a slot: the asset must declare the slot's type
 * AND the slot must accept the asset's category. Both directions must agree.
 */
export function isSlotCompatible(slot: SceneSlot, asset: NestAsset): boolean {
  return (
    asset.compatibleSlotTypes.indexOf(slot.slotType) !== -1 &&
    slot.acceptedAssetCategories.indexOf(asset.category) !== -1
  );
}

/**
 * Resolve which interaction applies to an object, by precedence:
 * assignment override → asset default → slot default → none.
 */
export function resolveInteractionId(
  slot: SceneSlot,
  asset: NestAsset,
  assignment?: SlotAssignment,
): string | undefined {
  return assignment?.interactionId ?? asset.defaultInteractionId ?? slot.defaultInteractionId;
}

/** Whether an asset is one of the two runtime-generated kinds (avatar / personal). */
export function isRuntimeGenerated(asset: NestAsset): boolean {
  return asset.source === "runtime_avatar" || asset.source === "runtime_personal";
}

/**
 * Whether an asset is a standalone editable-surface skin (category `surface`), i.e.
 * a book-cover / photo card that fills a host's editable surface rather than
 * snapping into a scene slot (Production Pack V1 · M9.1).
 */
export function isSurfaceAsset(asset: NestAsset): boolean {
  return asset.category === "surface";
}

export type NestValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Validate a ComposedNest against its template + an asset lookup. Pure and
 * deterministic — returns hard `errors` (invalid composition) and soft `warnings`
 * (e.g. an unfilled primary slot). Does not mutate. This is the contract the
 * future Composer will compose *to*; it is not the Composer.
 */
export function validateComposedNest(
  nest: ComposedNest,
  template: NestTemplate,
  assetsById: Record<string, NestAsset>,
): NestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (nest.templateId !== template.id) {
    errors.push(`templateId "${nest.templateId}" does not match template "${template.id}"`);
  }

  const ambienceOk = template.ambiencePresets.some((p) => p.id === nest.ambiencePresetId);
  if (!ambienceOk) {
    errors.push(`ambiencePresetId "${nest.ambiencePresetId}" is not defined on the template`);
  }

  const seenSlotIds = new Set<string>();
  for (const assignment of nest.slotAssignments) {
    if (seenSlotIds.has(assignment.slotId)) {
      errors.push(`slot "${assignment.slotId}" is assigned more than once`);
    }
    seenSlotIds.add(assignment.slotId);

    const slot = findSlot(template, assignment.slotId);
    if (!slot) {
      errors.push(`slot "${assignment.slotId}" does not exist on the template`);
      continue;
    }

    const asset = assetsById[assignment.assetId];
    if (!asset) {
      errors.push(`asset "${assignment.assetId}" (slot "${slot.id}") is not in the library`);
      continue;
    }

    if (!isSlotCompatible(slot, asset)) {
      errors.push(
        `asset "${asset.id}" (${asset.category}) is not compatible with slot "${slot.id}" (${slot.slotType})`,
      );
    }

    if (asset.approvalStatus !== "approved") {
      errors.push(`asset "${asset.id}" is not approved (status: ${asset.approvalStatus})`);
    }

    if (assignment.variantId && !asset.variants.some((v) => v.id === assignment.variantId)) {
      errors.push(`variant "${assignment.variantId}" does not exist on asset "${asset.id}"`);
    }
  }

  if (nest.avatarAssetId) {
    const avatar = assetsById[nest.avatarAssetId];
    if (!avatar) {
      errors.push(`avatarAssetId "${nest.avatarAssetId}" is not in the library`);
    } else if (avatar.category !== "avatar") {
      errors.push(`avatarAssetId "${nest.avatarAssetId}" is not an avatar asset`);
    }
  }

  for (const pid of nest.personalAssetIds) {
    if (!assetsById[pid]) {
      errors.push(`personal asset "${pid}" is not in the library`);
    }
  }

  for (const slot of primarySlots(template)) {
    if (!seenSlotIds.has(slot.id)) {
      warnings.push(`primary slot "${slot.id}" (${slot.slotType}) is unfilled`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
