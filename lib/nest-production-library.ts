// ── Nestudio Production Library — local layer (M10) ──────────────────────────
//
// Reads the seed fixture and overlays admin curation from localStorage: status
// overrides (approve/hide/archive/feature) + admin-created templates. NOTHING is
// ever hard-deleted — items only change status — so old Nests keep resolving assets
// by id even after they're pulled from the public flow.
//
// Local + SSR-safe only (fixtures + localStorage). No Supabase, no auth, no AI.

import type {
  ObjectPlacement,
  ProductionAsset,
  ProductionBackground,
  ProductionLibrary,
  ProductionLibraryStatus,
  ProductionTemplate,
} from "@/lib/nest-production-types";
import { isOnboardingVisible } from "@/lib/nest-production-types";
import { NEST_PRODUCTION_LIBRARY_V1 } from "@/lib/fixtures/nest-production-library-v1";

const STATUS_KEY = "nestudio-production-status"; // { [itemId]: status }
const TEMPLATES_KEY = "nestudio-production-custom-templates"; // ProductionTemplate[]
export const PRODUCTION_CHANGED_EVENT = "nestudio-production-changed";

const isBrowser = () => typeof window !== "undefined";

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(PRODUCTION_CHANGED_EVENT));
  } catch {
    /* ignore quota/SSR */
  }
}

// ── Status overrides ─────────────────────────────────────────────────────────
type StatusMap = Record<string, ProductionLibraryStatus>;

function statusOverrides(): StatusMap {
  return readJson<StatusMap>(STATUS_KEY, {});
}

/** Curate an item. Never deletes — only moves status. Persists + notifies. */
export function setItemStatus(itemId: string, status: ProductionLibraryStatus) {
  const map = statusOverrides();
  map[itemId] = status;
  writeJson(STATUS_KEY, map);
}

/** Reset every admin decision (back to fixture defaults). */
export function resetCuration() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STATUS_KEY);
  window.localStorage.removeItem(TEMPLATES_KEY);
  window.dispatchEvent(new CustomEvent(PRODUCTION_CHANGED_EVENT));
}

const applyStatus = <T extends { id: string; status: ProductionLibraryStatus }>(item: T, m: StatusMap): T =>
  m[item.id] ? { ...item, status: m[item.id] } : item;

// ── Custom (admin-authored) templates ────────────────────────────────────────
export function customTemplates(): ProductionTemplate[] {
  return readJson<ProductionTemplate[]>(TEMPLATES_KEY, []);
}

/** Save an admin-authored template locally as a draft. Returns the saved template. */
export function addCustomTemplate(input: {
  name: string;
  persona: string;
  backgroundId: string;
  objectPlacements: ObjectPlacement[];
  tags?: string[];
  previewImage?: string;
}): ProductionTemplate {
  const tpl: ProductionTemplate = {
    id: `tpl-custom-${Date.now()}`,
    name: input.name,
    persona: input.persona,
    backgroundId: input.backgroundId,
    objectPlacements: input.objectPlacements,
    tags: input.tags ?? [],
    previewImage: input.previewImage,
    status: "draft",
  };
  writeJson(TEMPLATES_KEY, [...customTemplates(), tpl]);
  return tpl;
}

// ── The resolved library (fixture + overrides + custom templates) ────────────
export function getLibrary(): ProductionLibrary {
  const m = statusOverrides();
  const base = NEST_PRODUCTION_LIBRARY_V1;
  return {
    backgrounds: base.backgrounds.map((b) => applyStatus(b, m)),
    assets: base.assets.map((a) => applyStatus(a, m)),
    templates: [...base.templates, ...customTemplates()].map((t) => applyStatus(t, m)),
  };
}

type VisibleOpts = { onlyVisible?: boolean };
const vis = <T extends { status: ProductionLibraryStatus }>(items: T[], o?: VisibleOpts) =>
  o?.onlyVisible ? items.filter((i) => isOnboardingVisible(i.status)) : items;

export function getBackgrounds(o?: VisibleOpts): ProductionBackground[] {
  return vis(getLibrary().backgrounds, o);
}
export function getAssets(o?: VisibleOpts): ProductionAsset[] {
  return vis(getLibrary().assets, o);
}
export function getTemplates(o?: VisibleOpts): ProductionTemplate[] {
  return vis(getLibrary().templates, o);
}

// Resolve-by-id ALWAYS returns the item regardless of status (old Nests must not
// break when an asset/background is hidden or archived).
export function resolveBackground(id: string): ProductionBackground | undefined {
  return getLibrary().backgrounds.find((b) => b.id === id);
}
export function resolveAsset(id: string): ProductionAsset | undefined {
  return getLibrary().assets.find((a) => a.id === id);
}
export function resolveTemplate(id: string): ProductionTemplate | undefined {
  return getLibrary().templates.find((t) => t.id === id);
}

/** Subscribe a client component to curation changes. Returns an unsubscribe fn. */
export function onProductionChanged(cb: () => void): () => void {
  if (!isBrowser()) return () => {};
  const h = () => cb();
  window.addEventListener(PRODUCTION_CHANGED_EVENT, h);
  window.addEventListener("storage", h); // cross-tab
  return () => {
    window.removeEventListener(PRODUCTION_CHANGED_EVENT, h);
    window.removeEventListener("storage", h);
  };
}

// ── Candidate → draft mapping (import generated candidates) ───────────────────
// Pure mapper: turns the P0 validation report shape into DRAFT library items. Admin
// must approve them manually (they land as status "draft", never auto-approved).

type ReportCandidate = {
  candidate: number;
  status?: string;
  cutoutPng?: string;
  masterPng?: string;
  variants?: Record<string, { path: string }>;
};
type ReportAsset = {
  assetId: string;
  name?: string;
  kind: string;
  aspectRatio?: string;
  transparencyRequired?: boolean;
  editableSurfaceSpec?: unknown;
  selectedCandidate: number | null;
  candidates: ReportCandidate[];
};
type ValidationReport = { assets: ReportAsset[]; cameraDna?: string; model?: string };

/** `public/nests/…` → `/nests/…` (served URL). */
const toUrl = (p?: string): string | undefined => (p ? "/" + p.replace(/^public\//, "") : undefined);

export type CandidateImport = { backgrounds: ProductionBackground[]; assets: ProductionAsset[] };

/**
 * Map the selected candidate of each report asset into a DRAFT library item. This is
 * how curated candidates enter the library — as drafts an admin then approves.
 */
export function mapCandidatesToDrafts(report: ValidationReport, cameraDnaVersion = "front-facing-v1"): CandidateImport {
  const out: CandidateImport = { backgrounds: [], assets: [] };
  for (const a of report.assets) {
    const c = a.candidates.find((x) => x.candidate === a.selectedCandidate && x.status === "generated");
    if (!c) continue;
    const variants = {
      mobile: toUrl(c.variants?.mobile?.path),
      standard: toUrl(c.variants?.standard?.path),
      focus: toUrl(c.variants?.focus?.path),
    };
    if (a.kind === "background") {
      out.backgrounds.push({
        id: `imp-${a.assetId}`, name: a.name ?? a.assetId, imageUrl: toUrl(c.masterPng) ?? "",
        variants, cameraDnaVersion: report.cameraDna ?? cameraDnaVersion, status: "draft",
        tags: [], sourceCandidateId: `${a.assetId}/c${a.selectedCandidate}`,
      });
    } else {
      out.assets.push({
        id: `imp-${a.assetId}`, name: a.name ?? a.assetId, category: "decor",
        imageUrl: toUrl(c.cutoutPng) ?? toUrl(c.masterPng) ?? "", cutoutUrl: toUrl(c.cutoutPng),
        variants, visualBounds: { aspect: a.aspectRatio, anchor: { x: 0.5, y: 1 } },
        compatibleSlotTypes: [], editableSurfaces: undefined, cameraDnaVersion: report.cameraDna ?? cameraDnaVersion,
        status: "draft", tags: [], sourceCandidateId: `${a.assetId}/c${a.selectedCandidate}`,
      });
    }
  }
  return out;
}
