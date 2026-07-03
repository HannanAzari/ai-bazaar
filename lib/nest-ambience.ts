// ── M19.1 — Ambient audio ARCHITECTURE (no sound files yet) ────────────────────
//
// We don't ship audio this sprint — we build the seam so a later sprint can drop in
// loops without touching the village/house code. Everything here is pure + data-only:
// a scene registry, a deterministic "what should this place sound like" resolver, and
// a flag (`ENABLE_NEST_AUDIO`, default OFF). No `<audio>`, no fetch, no autoplay.

import type { House } from "@/lib/nest-house";
import type { TimeOfDay, Weather } from "@/lib/nest-atmosphere";
import { isEnabled } from "@/lib/flags";

export type AmbienceSceneId =
  | "village"
  | "rain"
  | "birds"
  | "fireplace"
  | "coffee-shop"
  | "waves"
  | "wind"
  | "night-crickets";

export type AmbienceScene = {
  id: AmbienceSceneId;
  label: string;
  /** Where the loop WILL live once audio ships (not fetched today). */
  src: string;
  /** Sensible default loop volume (0–1) for when it does. */
  volume: number;
};

export const AMBIENCE_SCENES: Record<AmbienceSceneId, AmbienceScene> = {
  village: { id: "village", label: "Village hum", src: "/ambience/village.mp3", volume: 0.35 },
  rain: { id: "rain", label: "Soft rain", src: "/ambience/rain.mp3", volume: 0.5 },
  birds: { id: "birds", label: "Birdsong", src: "/ambience/birds.mp3", volume: 0.3 },
  fireplace: { id: "fireplace", label: "Fireplace", src: "/ambience/fireplace.mp3", volume: 0.4 },
  "coffee-shop": { id: "coffee-shop", label: "Coffee shop", src: "/ambience/coffee-shop.mp3", volume: 0.35 },
  waves: { id: "waves", label: "Waves", src: "/ambience/waves.mp3", volume: 0.4 },
  wind: { id: "wind", label: "Wind", src: "/ambience/wind.mp3", volume: 0.3 },
  "night-crickets": { id: "night-crickets", label: "Crickets", src: "/ambience/crickets.mp3", volume: 0.35 },
};

/** Is ambient audio switched on? (Flag only — nothing plays until audio ships.) */
export function ambienceEnabled(): boolean {
  return isEnabled("ENABLE_NEST_AUDIO");
}

/**
 * Deterministically choose the ambience for a place from its weather, time, and
 * persona — the same inputs that drive the visuals, so sound and scene agree. Pure.
 */
export function ambienceForScene(input: { weather: Weather; time: TimeOfDay; persona?: string }): AmbienceScene {
  const { weather, time, persona } = input;
  if (weather === "rain" || weather === "snow") return AMBIENCE_SCENES.rain;
  if (time === "night") return AMBIENCE_SCENES["night-crickets"];
  const p = (persona ?? "").toLowerCase();
  if (p.includes("writ") || p.includes("read")) return AMBIENCE_SCENES["coffee-shop"];
  if (p.includes("garden") || p.includes("nature") || p.includes("outdoor")) return AMBIENCE_SCENES.birds;
  if (p.includes("game")) return AMBIENCE_SCENES.fireplace;
  if (time === "morning") return AMBIENCE_SCENES.birds;
  return AMBIENCE_SCENES.village;
}

/** Ambience for a specific house's front (used by the arrival panel). */
export function ambienceForHouse(house: Pick<House, "persona">, weather: Weather, time: TimeOfDay): AmbienceScene {
  return ambienceForScene({ weather, time, persona: house.persona });
}
