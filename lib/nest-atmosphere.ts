// ── M19.1 — Atmosphere: time of day + weather ─────────────────────────────────
//
// The village is a *place*, and places have a time and a weather. This is pure,
// deterministic, dependency-free data (no APIs, no storage) that the scene backdrop
// + houses read to change the sky, the light, and the mood. Time of day comes from
// the visitor's clock; weather is a deterministic daily rotation (or a seed) so the
// whole village shares one sky and it's stable within a day — no `Math.random`.

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";
export type Weather = "sunny" | "cloudy" | "rain" | "snow";

/** Map a 0–23 hour to a part of the day. */
export function timeOfDay(hour: number): TimeOfDay {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export type SkyTheme = {
  key: TimeOfDay;
  label: string;
  /** Vertical sky gradient (top → bottom). */
  sky: [string, string, string];
  /** Sun/moon disc colour + soft glow colour. */
  disc: string;
  discGlow: string;
  /** Where the light sits (% across, % down). */
  discPos: { x: number; y: number };
  /** The moon replaces the sun + stars appear. */
  night: boolean;
  /** Window/lantern glow strength multiplier (dusk/night are warmer + brighter). */
  glow: number;
  /** A soft full-scene colour wash that ties the light together. */
  wash: string;
  /** Hill colours (front → back) so the ground reads the same light. */
  hills: [string, string, string];
};

export const SKY_THEMES: Record<TimeOfDay, SkyTheme> = {
  morning: {
    key: "morning", label: "Morning",
    sky: ["#cfe4f2", "#ffe8cf", "#ffd9ad"],
    disc: "#fff1cf", discGlow: "#ffd98a", discPos: { x: 22, y: 26 },
    night: false, glow: 0.55, wash: "rgba(255,214,150,0.10)",
    hills: ["#a9c882", "#93ac5f", "#6e8a47"],
  },
  afternoon: {
    key: "afternoon", label: "Afternoon",
    sky: ["#bfe1f4", "#dcecdf", "#f3ead0"],
    disc: "#fff6da", discGlow: "#ffe59c", discPos: { x: 50, y: 16 },
    night: false, glow: 0.4, wash: "rgba(255,246,210,0.06)",
    hills: ["#b0cf88", "#98b263", "#72904a"],
  },
  evening: {
    key: "evening", label: "Evening",
    sky: ["#5b4c86", "#d97e57", "#f0b07a"],
    disc: "#ffd39a", discGlow: "#ff9b5c", discPos: { x: 76, y: 30 },
    night: false, glow: 0.85, wash: "rgba(216,120,74,0.16)",
    hills: ["#7f9159", "#5f7742", "#45592f"],
  },
  night: {
    key: "night", label: "Night",
    sky: ["#171b33", "#262c4d", "#374063"],
    disc: "#f4f1e4", discGlow: "#b9c4e6", discPos: { x: 74, y: 22 },
    night: true, glow: 1.15, wash: "rgba(30,36,70,0.30)",
    hills: ["#3b4668", "#2f3956", "#252d47"],
  },
};

export function skyTheme(t: TimeOfDay): SkyTheme {
  return SKY_THEMES[t];
}

// ── Weather (deterministic) ────────────────────────────────────────────────────

// Stable 32-bit hash so a given key always yields the same weather (no randomness).
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Weighted bag — mostly kind weather, the occasional rain/snow for atmosphere.
const WEATHER_BAG: Weather[] = ["sunny", "sunny", "sunny", "cloudy", "cloudy", "rain", "snow"];

/** The whole village shares one sky: a deterministic daily rotation. */
export function weatherForDay(date: Date): Weather {
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  return WEATHER_BAG[hash(key) % WEATHER_BAG.length];
}

/** A per-seed weather (e.g. username hash) when a single house wants its own mood. */
export function weatherFromSeed(seed: number): Weather {
  return WEATHER_BAG[seed % WEATHER_BAG.length];
}

export type WeatherTheme = {
  key: Weather;
  label: string;
  /** Falling particles (rain streaks / snow flakes). */
  precip: "none" | "rain" | "snow";
  /** Extra cloud cover (0–1). */
  clouds: number;
  /** A cool overcast wash layered over the sky. */
  overcast: string;
};

export const WEATHER_THEMES: Record<Weather, WeatherTheme> = {
  sunny: { key: "sunny", label: "Clear", precip: "none", clouds: 0.15, overcast: "rgba(255,255,255,0)" },
  cloudy: { key: "cloudy", label: "Cloudy", precip: "none", clouds: 0.7, overcast: "rgba(180,186,196,0.18)" },
  rain: { key: "rain", label: "Rain", precip: "rain", clouds: 0.85, overcast: "rgba(120,132,150,0.26)" },
  snow: { key: "snow", label: "Snow", precip: "snow", clouds: 0.8, overcast: "rgba(214,224,236,0.22)" },
};

export function weatherTheme(w: Weather): WeatherTheme {
  return WEATHER_THEMES[w];
}
