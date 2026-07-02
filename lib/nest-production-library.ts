// ── Nestudio Production Library — layer (M10 local · M12.1 Supabase source) ──
//
// Source of the curated library. Default = the seed fixture + localStorage admin
// overrides (M10). When NEXT_PUBLIC_NEST_BACKEND=supabase, `hydrateLibrary()` pulls
// nest_backgrounds/nest_assets/nest_templates into an in-memory cache that the sync
// resolvers read; admin status writes go to Supabase. NOTHING is ever hard-deleted —
// items only change status — so published Nests keep resolving assets by id (any
// status). If Supabase is unavailable, the fixture path remains (safe fallback);
// fixtures are NOT removed.

import type {
  ObjectPlacement,
  ProductionAsset,
  ProductionBackground,
  ProductionItemType,
  ProductionLibrary,
  ProductionLibraryStatus,
  ProductionTemplate,
} from "@/lib/nest-production-types";
import { isOnboardingVisible } from "@/lib/nest-production-types";
import { NEST_PRODUCTION_LIBRARY_V1 } from "@/lib/fixtures/nest-production-library-v1";
import * as sbLibRepo from "@/lib/nest/supabase-library-repo";

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

// ── Backend + Supabase cache (M12.1) ─────────────────────────────────────────
const libraryBackend = () => (process.env.NEXT_PUBLIC_NEST_BACKEND === "supabase" ? "supabase" : "local");
let libraryCache: ProductionLibrary | null = null;

/**
 * Pull the curated library from Supabase into the in-memory cache (supabase backend
 * only). List components call this on mount; the sync resolvers then read the cache.
 * On failure or in local mode it's a no-op — the fixture + localStorage path stays
 * (safe local fallback). Notifies subscribers so onboarding/admin re-render.
 */
export async function hydrateLibrary(): Promise<void> {
  if (libraryBackend() !== "supabase") return;
  try {
    libraryCache = backfillImages(await sbLibRepo.fetchLibrary());
    if (isBrowser()) window.dispatchEvent(new CustomEvent(PRODUCTION_CHANGED_EVENT));
  } catch {
    /* keep the fixture fallback — never break local/offline */
  }
}

// If a Supabase row exists but its image URL is missing/empty, fall back to the
// bundled fixture image (deployable under public/nests/library-v1/) — matched by id.
// This keeps onboarding rendering even before Storage is fully populated.
function backfillImages(lib: ProductionLibrary): ProductionLibrary {
  const fx = NEST_PRODUCTION_LIBRARY_V1;
  const bg = new Map(fx.backgrounds.map((b) => [b.id, b]));
  const as = new Map(fx.assets.map((a) => [a.id, a]));
  const tp = new Map(fx.templates.map((t) => [t.id, t]));
  return {
    backgrounds: lib.backgrounds.map((b) => {
      const f = bg.get(b.id);
      const imageUrl = b.imageUrl || f?.imageUrl || "";
      return { ...b, imageUrl, variants: { ...b.variants, standard: b.variants?.standard || f?.variants?.standard || imageUrl } };
    }),
    assets: lib.assets.map((a) => {
      const f = as.get(a.id);
      const imageUrl = a.imageUrl || f?.cutoutUrl || f?.imageUrl || "";
      return { ...a, imageUrl, cutoutUrl: a.cutoutUrl || f?.cutoutUrl || imageUrl, variants: { ...a.variants, standard: a.variants?.standard || f?.variants?.standard || imageUrl } };
    }),
    templates: lib.templates.map((t) => {
      const f = tp.get(t.id);
      return { ...t, previewImage: t.previewImage || f?.previewImage };
    }),
  };
}

// ── Status overrides ─────────────────────────────────────────────────────────
type StatusMap = Record<string, ProductionLibraryStatus>;

function statusOverrides(): StatusMap {
  return readJson<StatusMap>(STATUS_KEY, {});
}

function inferItemType(itemId: string): ProductionItemType | undefined {
  const lib = getLibrary();
  if (lib.backgrounds.some((b) => b.id === itemId)) return "background";
  if (lib.assets.some((a) => a.id === itemId)) return "asset";
  if (lib.templates.some((t) => t.id === itemId)) return "template";
  return undefined;
}

/**
 * Curate an item. Never deletes — only moves status. Supabase backend writes to the
 * DB (then re-hydrates); local backend persists a localStorage override. Falls back
 * to the local override if the Supabase write fails.
 */
export async function setItemStatus(itemId: string, status: ProductionLibraryStatus): Promise<void> {
  if (libraryBackend() === "supabase") {
    const type = inferItemType(itemId);
    if (type) {
      try {
        await sbLibRepo.setStatus(type, itemId, status);
        await hydrateLibrary();
        return;
      } catch {
        /* fall through to a local override so the admin action isn't lost */
      }
    }
  }
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

/**
 * Save the CURRENT NestDocument state as a draft template (one shared path used by
 * the editor + admin — no duplicated template logic). A template is just a
 * pre-populated document: background + object placements + metadata.
 */
export function saveDocAsTemplate(input: {
  name: string;
  persona: string;
  backgroundId: string;
  placements: { assetId: string; slotType?: ObjectPlacement["slotType"]; x: number; y: number; scale?: number; zIndex?: number }[];
  tags?: string[];
  previewImage?: string;
}): ProductionTemplate {
  return addCustomTemplate({
    name: input.name,
    persona: input.persona,
    backgroundId: input.backgroundId,
    objectPlacements: input.placements.map((p) => ({
      assetId: p.assetId, slotType: p.slotType, x: p.x, y: p.y, scale: p.scale, zIndex: p.zIndex,
    })),
    tags: input.tags,
    previewImage: input.previewImage,
  });
}

// ── The resolved library ─────────────────────────────────────────────────────
// Supabase backend + hydrated → the DB cache (statuses live in the DB). Otherwise
// the fixture + localStorage overrides (M10 local path / pre-hydration fallback).
// Both are keyed by the same ids, so resolve-by-id works in either state.
export function getLibrary(): ProductionLibrary {
  if (libraryBackend() === "supabase" && libraryCache) return libraryCache;
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
