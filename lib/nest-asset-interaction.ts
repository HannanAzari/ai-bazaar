// ── M25 §P2 — what an object can DO ──────────────────────────────────────────
//
// One typed capability model, replacing behaviour scattered across components. An asset
// declares what it supports; a creator configures it within those bounds; the runtime
// executes only what the model allows.
//
// Two rules this file exists to enforce:
//
//  1. **Capability comes from the CATALOGUE, configuration comes from the CREATOR.** The
//     catalogue says "a TV can be on or off and can carry a screen"; the creator's document
//     says "this TV starts off and its screen plays <url>". Neither guesses from the asset
//     id — D-34.
//
//  2. **Session state is not authored state.** A lamp the visitor switched on is a fact
//     about this visit; the lamp's *initial* state is a fact about the Nest. Only the
//     second is ever written to Supabase. A visitor tapping things must never produce a
//     database write.
//
// Pure: no React, no DOM, no Supabase.

import type { NestPlacement } from "@/lib/nest-document-types";
import { safeUrl, youTubeVideoId, type NestInteraction } from "@/lib/nest-interaction";

// ── Capabilities ─────────────────────────────────────────────────────────────

export type InteractionCapability =
  | "toggle" // lamp, speaker indicator — two visual states, no content
  | "open-close" // laptop, curtain — closed/open, may reveal content
  | "play-pause" // speaker — playback state
  | "screen" // TV, laptop, console — carries a picture and/or media
  | "media" // opens video/audio content
  | "external-link" // opens a URL
  | "gallery"; // opens a set of images

export const INTERACTION_CAPABILITIES: InteractionCapability[] = [
  "toggle",
  "open-close",
  "play-pause",
  "screen",
  "media",
  "external-link",
  "gallery",
];

/** What content an asset's screen/media slot accepts. */
export type ConnectedContentKind = "youtube" | "video" | "audio" | "website" | "image";

/** One visual state of an asset — a variant image and/or a local light effect. */
export type AssetVisualState = {
  /** Human label for the creator panel ("Off", "On", "Open"). */
  label: string;
  /** Optional replacement art for this state. Absent ⇒ the base art is reused. */
  imageUrl?: string;
  /**
   * A local glow, in the object's own box. This is how a lamp changes the room without a
   * second asset: it paints under/over the object rather than re-lighting the background,
   * which would need per-background art we do not have.
   */
  glow?: { color: string; opacity: number; scale: number };
  /** Show the connected content's screen picture in this state. */
  showsScreen?: boolean;
};

/** The catalogue entry: what this asset TYPE can do. */
export type AssetInteractionCapabilityDef = {
  capabilities: InteractionCapability[];
  /** State id → visual. The first key is the default when the creator picks nothing. */
  states: Record<string, AssetVisualState>;
  defaultState: string;
  /** The state a tap moves to from each state. A closed 2-cycle unless declared otherwise. */
  toggleTo?: Record<string, string>;
  /** Content kinds this asset's screen/media slot accepts. Empty ⇒ no content slot. */
  accepts: ConnectedContentKind[];
  /** The surface id (from SURFACE_CATALOG) this asset's screen picture draws into. */
  screenSurfaceId?: string;
  allowsSound?: boolean;
};

/** The creator's configuration, stored on the placement. */
export type AssetInteractionConfig = {
  /** Which state the Nest OPENS in. Authored — persists. */
  initialState?: string;
  /** The connected content, if any. Authored — persists. */
  connection?: ConnectedContent;
  /** Creator opted out of interaction for this instance even though the asset supports it. */
  disabled?: boolean;
};

export type ConnectedContent = {
  kind: ConnectedContentKind;
  url?: string;
  /** A still shown on the screen before/instead of playback. */
  thumbnailUrl?: string;
  label?: string;
  loop?: boolean;
};

// ── The catalogue ────────────────────────────────────────────────────────────
//
// A deliberately SMALL, polished benchmark set. Declaring every asset interactive would be
// a lie the runtime then has to keep — an object that looks tappable and does nothing is
// worse than an object that plainly does not.

const LAMP_GLOW = { color: "255,214,150", opacity: 0.55, scale: 2.6 };

const CAPABILITIES: Record<string, AssetInteractionCapabilityDef> = {
  // ── TV: off → on, screen carries the connected media ──
  "ast-tv": {
    capabilities: ["toggle", "screen", "media", "external-link"],
    defaultState: "off",
    states: {
      off: { label: "Off" },
      on: { label: "On", showsScreen: true, glow: { color: "170,205,255", opacity: 0.22, scale: 1.5 } },
    },
    toggleTo: { off: "on", on: "off" },
    accepts: ["youtube", "video", "image", "website"],
    screenSurfaceId: "tv-screen",
    allowsSound: true,
  },
  // ── Laptop: closed → open → open showing its screen.
  //
  // Mapped onto `ast-desk`, because that is where the laptop art actually lives (its
  // `laptop-screen` surface is in SURFACE_CATALOG). A standalone laptop asset does not
  // exist yet; when the Asset Factory ships one, register it with the same shape.
  "ast-desk": {
    capabilities: ["open-close", "screen", "external-link"],
    defaultState: "closed",
    states: {
      closed: { label: "Closed" },
      open: { label: "Open", showsScreen: true, glow: { color: "200,225,255", opacity: 0.18, scale: 1.3 } },
    },
    toggleTo: { closed: "open", open: "closed" },
    accepts: ["website", "image", "youtube"],
    screenSurfaceId: "laptop-screen",
  },
  // ── Speaker: indicator + playback ──
  "ast-speaker": {
    capabilities: ["toggle", "play-pause", "media"],
    defaultState: "off",
    states: {
      off: { label: "Off" },
      playing: { label: "Playing", glow: { color: "120,255,190", opacity: 0.4, scale: 1.2 } },
    },
    toggleTo: { off: "playing", playing: "off" },
    accepts: ["audio"],
    allowsSound: true,
  },
  // ── Console: on/off + a linked stream ──
  "ast-console": {
    capabilities: ["toggle", "media", "external-link"],
    defaultState: "off",
    states: {
      off: { label: "Off" },
      on: { label: "On", glow: { color: "140,180,255", opacity: 0.45, scale: 1.25 } },
    },
    toggleTo: { off: "on", on: "off" },
    accepts: ["youtube", "website", "video"],
    allowsSound: true,
  },
  // ── Lamp: pure local light. No URL, ever. ──
  "ast-floor-lamp": {
    capabilities: ["toggle"],
    defaultState: "off",
    states: { off: { label: "Off" }, on: { label: "On", glow: LAMP_GLOW } },
    toggleTo: { off: "on", on: "off" },
    accepts: [],
  },
  "ast-desk-lamp": {
    capabilities: ["toggle"],
    defaultState: "off",
    states: { off: { label: "Off" }, on: { label: "On", glow: LAMP_GLOW } },
    toggleTo: { off: "on", on: "off" },
    accepts: [],
  },
  // ── Curtain: open/closed. No URL. ──
  "ast-curtain": {
    capabilities: ["open-close"],
    defaultState: "closed",
    states: { closed: { label: "Closed" }, open: { label: "Open" } },
    toggleTo: { closed: "open", open: "closed" },
    accepts: [],
  },
  // ── Books: open to reveal writing. ──
  "ast-stacked-books": {
    capabilities: ["open-close", "external-link", "gallery"],
    defaultState: "closed",
    states: { closed: { label: "Closed" }, open: { label: "Open", showsScreen: true } },
    toggleTo: { closed: "open", open: "closed" },
    accepts: ["website", "image"],
    screenSurfaceId: "book-cover",
  },
  // ── Framed photo: a gallery, no state change. ──
  "ast-framed-photo": {
    capabilities: ["gallery", "screen"],
    defaultState: "shown",
    states: { shown: { label: "Shown", showsScreen: true } },
    accepts: ["image", "website"],
    screenSurfaceId: "frame-photo",
  },
};

// ── Awaiting art ─────────────────────────────────────────────────────────────
//
// Speaker, console and curtain are specified by the brief but have NO ASSET IN THE
// LIBRARY yet. Their capabilities are declared and unit-tested here so the model is
// complete and the Asset Factory has a contract to build against — but they cannot appear
// in a room until the art exists, and the benchmark Nest therefore cannot show them.
// Declaring them is not the same as shipping them; see the sprint report.
export const AWAITING_ART: string[] = ["ast-speaker", "ast-console", "ast-curtain", "ast-laptop"];

/** Assets that are deliberately scenery. Listed so the intent is explicit, not accidental. */
export const NON_INTERACTIVE_ASSETS = ["ast-potted-plant", "ast-plant-beta", "ast-side-plant", "ast-rug", "ast-sofa"];

/** What this asset type can do, or null when it is scenery. */
export function capabilitiesForAsset(assetId: string): AssetInteractionCapabilityDef | null {
  return CAPABILITIES[assetId] ?? null;
}

/** Register capabilities for an asset at runtime (used by the Asset Factory seam). */
export function registerAssetCapabilities(assetId: string, def: AssetInteractionCapabilityDef): void {
  CAPABILITIES[assetId] = def;
}

// ── Reading the creator's configuration off a placement ──────────────────────
//
// It rides in the EXISTING `nest_objects.interaction` jsonb bag, which already round-trips
// losslessly (verified in M24E). No new column, and therefore no migration — see
// `docs/M25_SPRINT_REPORT.md` §Schema.

export function configForPlacement(p: NestPlacement): AssetInteractionConfig | undefined {
  return p.interaction?.asset;
}

/** The state a Nest OPENS this object in. Authored, never a visitor's session state. */
export function initialStateOf(p: NestPlacement): string | null {
  const def = capabilitiesForAsset(p.assetId);
  if (!def) return null;
  const cfg = configForPlacement(p);
  if (cfg?.disabled) return null;
  const wanted = cfg?.initialState;
  return wanted && def.states[wanted] ? wanted : def.defaultState;
}

/** Whether a visitor can do anything with this object at all. */
export function isInteractiveObject(p: NestPlacement): boolean {
  const def = capabilitiesForAsset(p.assetId);
  if (!def || configForPlacement(p)?.disabled) return false;
  // A stateful object is interactive on its own; a content-only one needs a connection.
  if (def.toggleTo) return true;
  return Boolean(resolveConnection(p));
}

/** The creator's connected content, validated. Unsafe or malformed URLs resolve to null. */
export function resolveConnection(p: NestPlacement): ConnectedContent | null {
  const def = capabilitiesForAsset(p.assetId);
  const c = configForPlacement(p)?.connection;
  if (!def || !c) return null;
  if (!def.accepts.includes(c.kind)) return null; // asset does not accept this kind
  if (c.kind === "image") return c.thumbnailUrl || c.url ? c : null;
  const url = safeUrl(c.url);
  if (!url) return null;
  if (c.kind === "youtube" && !youTubeVideoId(url)) return null;
  return { ...c, url };
}

/** The next state after a tap, or the same state when the object has none. */
export function nextState(assetId: string, current: string): string {
  const def = capabilitiesForAsset(assetId);
  return def?.toggleTo?.[current] ?? current;
}

/** The visual for a state, falling back to the default rather than rendering nothing. */
export function visualStateOf(assetId: string, state: string | null): AssetVisualState | null {
  const def = capabilitiesForAsset(assetId);
  if (!def) return null;
  return def.states[state ?? def.defaultState] ?? def.states[def.defaultState] ?? null;
}

// ── What a tap actually does ─────────────────────────────────────────────────

/**
 * The result of tapping an object in a given state.
 *
 * Deliberately returns BOTH a state change and an optional content action, because a TV
 * does both at once: it turns on *and* opens what it is connected to. Splitting them into
 * two taps was the old Focus/Surface confusion in a new costume.
 */
export type ObjectTapResult = {
  /** The state to move to, or null to stay. */
  state: string | null;
  /** Content to open, or null. */
  open: NestInteraction | null;
};

export function tapObject(p: NestPlacement, currentState: string | null): ObjectTapResult {
  const def = capabilitiesForAsset(p.assetId);
  if (!def || configForPlacement(p)?.disabled) return { state: null, open: null };

  const from = currentState ?? initialStateOf(p) ?? def.defaultState;
  const to = def.toggleTo?.[from] ?? null;
  const connection = resolveConnection(p);

  // Turning OFF / closing never opens content — that would reopen a modal the visitor just
  // dismissed by switching the object off.
  const turningOff = to != null && (to === "off" || to === "closed");
  if (turningOff || !connection) return { state: to, open: null };

  // Content that plays IN the room's own screen (a picture on the TV) is not a modal; it is
  // the state change. Only content that needs its own surface opens one.
  const open = contentInteraction(connection, def);
  return { state: to, open };
}

function contentInteraction(c: ConnectedContent, def: AssetInteractionCapabilityDef): NestInteraction | null {
  const url = c.url ? safeUrl(c.url) : null;
  const label = c.label;
  switch (c.kind) {
    case "youtube": {
      const id = url ? youTubeVideoId(url) : null;
      return id && url ? { type: "open-youtube", url, videoId: id, ...(label ? { label } : {}) } : null;
    }
    case "video":
    case "audio":
      // Audio plays through the object itself (a speaker has no screen to open).
      return c.kind === "audio" ? null : url ? { type: "open-url", url, ...(label ? { label } : {}) } : null;
    case "website":
      return url ? { type: "open-url", url, ...(label ? { label } : {}) } : null;
    case "image":
      // An image belongs on the object's own screen when it has one; otherwise a modal.
      return def.screenSurfaceId ? null : url ? { type: "open-url", url, ...(label ? { label } : {}) } : null;
  }
}

/** Audio the object should be playing in a state, or null. Session-only. */
export function audioFor(p: NestPlacement, state: string | null): { url: string; loop: boolean } | null {
  const def = capabilitiesForAsset(p.assetId);
  if (!def?.allowsSound) return null;
  const c = resolveConnection(p);
  if (!c || c.kind !== "audio" || !c.url) return null;
  const playing = state === "playing" || state === "on";
  return playing ? { url: c.url, loop: c.loop !== false } : null;
}

// ── The creator panel's vocabulary ───────────────────────────────────────────
//
// Plain language only. A creator never sees "hotspot binding", "surface projection",
// "child scene" or "target scene" — those are our words for our problems.

export type CreatorAction = { id: string; label: string; help: string };

export function creatorActionsFor(assetId: string): CreatorAction[] {
  const def = capabilitiesForAsset(assetId);
  if (!def) return [];
  const out: CreatorAction[] = [];
  if (def.toggleTo) {
    const [a, b] = Object.keys(def.states);
    const isOpen = def.capabilities.includes("open-close");
    out.push({
      id: isOpen ? "open-close" : "toggle",
      label: isOpen ? "Open / close" : "Turn on / off",
      help: `Visitors tap it to switch between ${def.states[a]?.label ?? a} and ${def.states[b]?.label ?? b}.`,
    });
  }
  if (def.accepts.length) {
    out.push({
      id: "connect",
      label: def.screenSurfaceId ? "Show something on the screen" : "Open something",
      help: `Accepts ${def.accepts.join(", ")}.`,
    });
  }
  return out;
}

/** The creator-facing name of a state ("Off", "Open"). */
export function stateLabel(assetId: string, state: string): string {
  return capabilitiesForAsset(assetId)?.states[state]?.label ?? state;
}
