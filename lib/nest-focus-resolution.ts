// ── Nestudio V2 — Focus resolution audit & policy (M7C.1) ───────────────────
//
// Pure, deterministic image-quality math for deciding whether an EXISTING asset/scene
// crop stays acceptable when enlarged by a Zoom Region — BEFORE recommending any
// higher-resolution replacement (the sprint's central rule: measure, don't assume).
//
// No OCR, no computer vision, no I/O, no Math.random, no Date.now. Just metadata math:
// source pixels available inside a crop vs. the display pixels that crop must fill once
// it is zoomed to the viewport. The browser screenshots + human inspection that confirm
// these numbers live in the verification step; this module is the repeatable calculator.

import type {
  FocusImageSources,
  FocusResolutionStrategy,
  NestFocusBounds,
} from "@/lib/nest-focus-types";

export type FocusResolutionVerdict = "excellent" | "acceptable" | "soft" | "unusable";

/** A single repeatable measurement for one crop on one viewport (sprint shape). */
export interface FocusResolutionAudit {
  assetId?: string;
  sceneId: string;
  regionId: string;

  /** Full source raster dimensions (px). */
  sourceWidth: number;
  sourceHeight: number;

  /** Source pixels actually available inside the crop. */
  cropPixelWidth: number;
  cropPixelHeight: number;

  /** Display pixels (CSS px) the crop fills once zoomed to the viewport. */
  targetDisplayWidth: number;
  targetDisplayHeight: number;

  /** Enlargement ratio = display px per source px (>1 ⇒ upscaling). */
  scaleX: number;
  scaleY: number;

  /** Effective source pixels per displayed pixel (the limiting axis). */
  sourcePixelsPerDisplayPixel: number;
  /** The device-pixel-ratio used (1 = CSS px; >1 audits a high-density screen). */
  devicePixelRatio: number;

  verdict: FocusResolutionVerdict;
  notes?: string;
}

// ── Verdict thresholds (deterministic) ─────────────────────────────────────────
//
// Measured in source-pixels-per-displayed-pixel. ≥1 means at least one real source
// pixel backs every displayed pixel (no upscaling) — crisp. Below ~0.4 the image is
// being stretched >2.5× and softens badly.
export const RESOLUTION_THRESHOLDS = {
  excellent: 1.0,
  acceptable: 0.66,
  soft: 0.4,
} as const;

const round = (n: number, p = 3): number => +n.toFixed(p);

/** Map a source-px-per-display-px ratio to a deterministic verdict. */
export function resolutionVerdict(sourcePixelsPerDisplayPixel: number): FocusResolutionVerdict {
  const r = sourcePixelsPerDisplayPixel;
  if (!Number.isFinite(r) || r <= 0) return "unusable";
  if (r >= RESOLUTION_THRESHOLDS.excellent) return "excellent";
  if (r >= RESOLUTION_THRESHOLDS.acceptable) return "acceptable";
  if (r >= RESOLUTION_THRESHOLDS.soft) return "soft";
  return "unusable";
}

// ── Core audit ─────────────────────────────────────────────────────────────────

export interface FocusResolutionAuditInput {
  sceneId: string;
  regionId: string;
  assetId?: string;

  /** Full source raster dimensions (px). */
  sourceWidth: number;
  sourceHeight: number;

  /** Fraction of the source (0..1 each axis) the crop spans. 1 = the whole raster. */
  cropFractionX: number;
  cropFractionY: number;

  /** Display px (CSS px) the crop fills after the zoom. */
  targetDisplayWidth: number;
  targetDisplayHeight: number;

  /** Audit a high-density screen (e.g. 2 or 3). Default 1 (CSS px). */
  devicePixelRatio?: number;
  notes?: string;
}

/**
 * Compute one resolution audit. Pure: same input ⇒ identical output. `cropFraction*`
 * is how much of the source raster the crop uses (the background of a tight zoom uses a
 * small fraction; an object cut-out shown whole uses 1). `targetDisplay*` is the CSS px
 * that region occupies once zoomed.
 */
export function auditFocusResolution(input: FocusResolutionAuditInput): FocusResolutionAudit {
  const dpr = input.devicePixelRatio ?? 1;
  const cropPixelWidth = Math.round(input.cropFractionX * input.sourceWidth);
  const cropPixelHeight = Math.round(input.cropFractionY * input.sourceHeight);

  const displayDevW = input.targetDisplayWidth * dpr;
  const displayDevH = input.targetDisplayHeight * dpr;

  const scaleX = cropPixelWidth > 0 ? round(input.targetDisplayWidth / cropPixelWidth) : Infinity;
  const scaleY = cropPixelHeight > 0 ? round(input.targetDisplayHeight / cropPixelHeight) : Infinity;

  const sppX = displayDevW > 0 ? cropPixelWidth / displayDevW : 0;
  const sppY = displayDevH > 0 ? cropPixelHeight / displayDevH : 0;
  const sourcePixelsPerDisplayPixel = round(Math.min(sppX, sppY));

  return {
    assetId: input.assetId,
    sceneId: input.sceneId,
    regionId: input.regionId,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    cropPixelWidth,
    cropPixelHeight,
    targetDisplayWidth: round(input.targetDisplayWidth, 1),
    targetDisplayHeight: round(input.targetDisplayHeight, 1),
    scaleX,
    scaleY,
    sourcePixelsPerDisplayPixel,
    devicePixelRatio: dpr,
    verdict: resolutionVerdict(sourcePixelsPerDisplayPixel),
    notes: input.notes,
  };
}

// ── Strategy policy (Phase 2) ──────────────────────────────────────────────────

export interface StrategyInput {
  verdict: FocusResolutionVerdict;
  /** A correctly-composed but higher-res source exists/could be supplied. */
  hasHighRes?: boolean;
  /** The problem is PERSPECTIVE (front-view can't reveal the surface), not pixels. */
  perspectiveMismatch?: boolean;
  /** Small interactive objects would read better as separate sharper overlays. */
  childAssetsSharper?: boolean;
}

/**
 * Recommend a resolution strategy from the measured verdict + context. Deterministic.
 * Perspective always wins (no amount of pixels fixes a wrong camera). Otherwise: a crisp
 * crop reuses the source; a soft crop prefers a hi-res variant when one can exist, else
 * sharper child overlays; an unusable crop needs a hi-res variant or a Detail Surface.
 */
export function recommendStrategy(input: StrategyInput): FocusResolutionStrategy {
  if (input.perspectiveMismatch) return "use_detail_surface";
  switch (input.verdict) {
    case "excellent":
    case "acceptable":
      return "reuse_source";
    case "soft":
      if (input.hasHighRes) return "load_high_res_variant";
      if (input.childAssetsSharper) return "reuse_source_with_child_assets";
      return "reuse_source";
    case "unusable":
      return input.hasHighRes ? "load_high_res_variant" : "use_detail_surface";
  }
}

// ── Author-facing warnings (Phase 11) ──────────────────────────────────────────

/** Non-technical guidance for an ordinary creator (null = nothing to surface). */
export function creatorResolutionWarning(verdict: FocusResolutionVerdict): string | null {
  if (verdict === "soft" || verdict === "unusable") return "This area may look blurry when enlarged.";
  return null;
}

/** Richer template-author / internal guidance. */
export function authorResolutionGuidance(audit: FocusResolutionAudit): string {
  switch (audit.verdict) {
    case "excellent":
      return "Zoom quality: Excellent";
    case "acceptable":
      return "Zoom quality: Acceptable";
    case "soft":
      return audit.devicePixelRatio > 1
        ? "Zoom quality may appear soft on high-density phones"
        : "Zoom quality: may appear soft — consider a high-resolution focus image";
    case "unusable":
      return "Recommended: provide a high-resolution focus image";
  }
}

/** Whether publishing should be blocked (only the genuinely unusable case). */
export function blocksPublishing(verdict: FocusResolutionVerdict): boolean {
  return verdict === "unusable";
}

// ── Progressive source selection (Phase 12) ────────────────────────────────────

/**
 * Which image URL to render. Show `standardUrl` immediately; switch to
 * `highResolutionUrl` only once it has actually loaded. A failed/absent hi-res keeps
 * standard (no broken-image state, crop alignment preserved). Pure.
 */
export function selectFocusImageSource(
  sources: FocusImageSources | undefined,
  highResLoaded: boolean,
): string | undefined {
  if (!sources) return undefined;
  if (highResLoaded && sources.highResolutionUrl) return sources.highResolutionUrl;
  return sources.standardUrl;
}

// ── Measured source dimensions (real px — see docs/nest-hybrid-focus-v1.md) ────
//
// These are the ACTUAL pixel dimensions of the approved cut-outs / background, read
// from the files. They are the factual inputs to every prototype audit so the numbers
// in the docs and tests are reproducible, not guessed.
export const FOCUS_SOURCE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  background: { width: 1086, height: 1448 },
  "ast-tv": { width: 1489, height: 962 },
  "ast-framed-photo": { width: 843, height: 814 },
  "ast-stacked-books": { width: 1119, height: 640 },
  "ast-bookshelf": { width: 535, height: 1499 },
  "ast-desk": { width: 1149, height: 1015 },
  "ast-side-plant": { width: 828, height: 1155 },
  "ast-avatar": { width: 672, height: 1639 },
  "ast-floor-lamp": { width: 436, height: 1510 },
};

// ── Stage / viewport geometry (matches GoldenLivingNestStage) ──────────────────

/** The stage is capped: width = min(94vw, 460px); height follows the 3:4 aspect. */
export const STAGE_MAX_WIDTH = 460;

/** The rendered scene (CSS px) for a given viewport width + aspect ratio. */
export function sceneDisplaySize(viewportWidth: number, aspectRatio = "3:4"): { width: number; height: number } {
  const width = Math.min(viewportWidth * 0.94, STAGE_MAX_WIDTH);
  const [aw, ah] = aspectRatio.split(":").map(Number);
  const ratio = aw && ah ? ah / aw : 4 / 3;
  return { width: round(width, 1), height: round(width * ratio, 1) };
}

/** The four sprint test viewports (device width in CSS px). */
export const AUDIT_VIEWPORTS: { label: string; width: number }[] = [
  { label: "375×812", width: 375 },
  { label: "390×844", width: 390 },
  { label: "430×932", width: 430 },
  { label: "desktop", width: 1280 },
];

// ── Convenience builders for a Zoom Region's audit ─────────────────────────────

/**
 * Audit the BACKGROUND of a zoom crop: the crop spans `crop` (normalized scene), and
 * when zoomed to `scale` it fills `crop.width * scene * scale` display px. The fraction
 * of the background raster used equals the crop's normalized size.
 */
export function auditZoomBackground(opts: {
  sceneId: string;
  regionId: string;
  crop: NestFocusBounds;
  viewportWidth: number;
  aspectRatio?: string;
  devicePixelRatio?: number;
}): FocusResolutionAudit {
  const scene = sceneDisplaySize(opts.viewportWidth, opts.aspectRatio);
  const scale = zoomScale(opts.crop);
  return auditFocusResolution({
    sceneId: opts.sceneId,
    regionId: opts.regionId,
    assetId: "background",
    sourceWidth: FOCUS_SOURCE_DIMENSIONS.background.width,
    sourceHeight: FOCUS_SOURCE_DIMENSIONS.background.height,
    cropFractionX: opts.crop.width,
    cropFractionY: opts.crop.height,
    targetDisplayWidth: opts.crop.width * scene.width * scale,
    targetDisplayHeight: opts.crop.height * scene.height * scale,
    devicePixelRatio: opts.devicePixelRatio,
    notes: "background crop",
  });
}

/**
 * Audit an OBJECT cut-out seen inside a zoom crop. The whole cut-out is shown
 * (cropFraction = 1) and occupies `obj.size / crop.size` of the zoomed crop's display.
 */
export function auditZoomObject(opts: {
  sceneId: string;
  regionId: string;
  assetId: string;
  /** The object's normalized box on the source scene. */
  objectBounds: NestFocusBounds;
  crop: NestFocusBounds;
  viewportWidth: number;
  aspectRatio?: string;
  devicePixelRatio?: number;
}): FocusResolutionAudit {
  const dims = FOCUS_SOURCE_DIMENSIONS[opts.assetId] ?? { width: 1, height: 1 };
  const scene = sceneDisplaySize(opts.viewportWidth, opts.aspectRatio);
  const scale = zoomScale(opts.crop);
  const cropDisplayW = opts.crop.width * scene.width * scale;
  const cropDisplayH = opts.crop.height * scene.height * scale;
  return auditFocusResolution({
    sceneId: opts.sceneId,
    regionId: opts.regionId,
    assetId: opts.assetId,
    sourceWidth: dims.width,
    sourceHeight: dims.height,
    cropFractionX: 1,
    cropFractionY: 1,
    targetDisplayWidth: (opts.objectBounds.width / opts.crop.width) * cropDisplayW,
    targetDisplayHeight: (opts.objectBounds.height / opts.crop.height) * cropDisplayH,
    devicePixelRatio: opts.devicePixelRatio,
    notes: "object cut-out in zoom",
  });
}

/**
 * The CSS-transform scale that makes a crop fill the viewport while preserving aspect
 * (Phase 4): scale = min(viewportW/cropW, viewportH/cropH). Because the scene IS the
 * viewport, this reduces to 1 / max(crop.width, crop.height).
 */
export function zoomScale(crop: Pick<NestFocusBounds, "width" | "height">): number {
  const denom = Math.max(crop.width, crop.height);
  return denom > 0 ? round(1 / denom) : 1;
}
