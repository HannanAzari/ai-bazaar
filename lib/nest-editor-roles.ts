// ── Nestudio V2 — editor capability roles (M7B.1) ───────────────────────────
//
// A small, central capability policy (not scattered conditionals) for the three
// authoring levels. No authentication — a local/internal mode switch drives it in the
// prototype. Creators arrange + connect predefined hotspots; template authors
// calibrate (visual bounds, occupied zones, hotspot authoring, policy, support
// rules); internal adds raw debug, ids, production warnings, metadata validation.

export type EditorRole = "creator" | "template_author" | "internal";

export const EDITOR_ROLES: EditorRole[] = ["creator", "template_author", "internal"];

export interface EditorCapabilities {
  /** Add a basic custom interaction region (creators may, when allowed). */
  addCustomRegion: boolean;
  /** Full hotspot authoring (rename/semantic/lock/enable/delete + geometry). */
  authorHotspots: boolean;
  /** Edit visual-content bounds. */
  editVisualBounds: boolean;
  /** Edit occupied zones. */
  editOccupiedZones: boolean;
  /** Tune rotation/flip policy + support rules + calibrate defaults. */
  tunePolicy: boolean;
  /** See/edit raw interaction & hotspot ids and precise numeric geometry. */
  editRawIds: boolean;
  /** Show internal debug information + metadata validation. */
  showDebug: boolean;
  /** Show full production-readiness (placeholder) warnings. */
  showProductionWarnings: boolean;
  /** Show the advanced precision (x/y/w/h/z/plane) controls. */
  showPrecision: boolean;
}

const CAPS: Record<EditorRole, EditorCapabilities> = {
  creator: {
    addCustomRegion: true,
    authorHotspots: false,
    editVisualBounds: false,
    editOccupiedZones: false,
    tunePolicy: false,
    editRawIds: false,
    showDebug: false,
    showProductionWarnings: false,
    showPrecision: false,
  },
  template_author: {
    addCustomRegion: true,
    authorHotspots: true,
    editVisualBounds: true,
    editOccupiedZones: true,
    tunePolicy: true,
    editRawIds: false,
    showDebug: false,
    showProductionWarnings: false,
    showPrecision: true,
  },
  internal: {
    addCustomRegion: true,
    authorHotspots: true,
    editVisualBounds: true,
    editOccupiedZones: true,
    tunePolicy: true,
    editRawIds: true,
    showDebug: true,
    showProductionWarnings: true,
    showPrecision: true,
  },
};

export function capabilitiesFor(role: EditorRole): EditorCapabilities {
  return CAPS[role];
}

export function can(role: EditorRole, capability: keyof EditorCapabilities): boolean {
  return CAPS[role][capability];
}

export function roleLabel(role: EditorRole): string {
  return role === "template_author" ? "Template author" : role === "internal" ? "Internal" : "Creator";
}
