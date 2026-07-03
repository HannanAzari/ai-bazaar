import { describe, expect, it } from "vitest";
import {
  SKY_THEMES,
  WEATHER_THEMES,
  skyTheme,
  timeOfDay,
  weatherForDay,
  weatherFromSeed,
  weatherTheme,
} from "@/lib/nest-atmosphere";
import { ambienceForScene, ambienceEnabled, AMBIENCE_SCENES } from "@/lib/nest-ambience";

describe("timeOfDay", () => {
  it("buckets hours into parts of the day", () => {
    expect(timeOfDay(7)).toBe("morning");
    expect(timeOfDay(13)).toBe("afternoon");
    expect(timeOfDay(19)).toBe("evening");
    expect(timeOfDay(23)).toBe("night");
    expect(timeOfDay(2)).toBe("night");
  });
  it("handles boundaries + out-of-range hours", () => {
    expect(timeOfDay(5)).toBe("morning");
    expect(timeOfDay(11)).toBe("afternoon");
    expect(timeOfDay(17)).toBe("evening");
    expect(timeOfDay(21)).toBe("night");
    expect(timeOfDay(-1)).toBe("night"); // 23:00
    expect(timeOfDay(24)).toBe("night"); // 00:00
  });
});

describe("sky themes", () => {
  it("every part of day has a full theme with 3 sky stops + hills", () => {
    for (const t of ["morning", "afternoon", "evening", "night"] as const) {
      const th = skyTheme(t);
      expect(th).toBe(SKY_THEMES[t]);
      expect(th.sky).toHaveLength(3);
      th.sky.forEach((c) => expect(c).toMatch(/^#/));
      expect(th.hills).toHaveLength(3);
      expect(th.glow).toBeGreaterThan(0);
    }
  });
  it("night is the only starry theme and glows strongest", () => {
    expect(SKY_THEMES.night.night).toBe(true);
    expect(SKY_THEMES.morning.night).toBe(false);
    expect(SKY_THEMES.night.glow).toBeGreaterThan(SKY_THEMES.afternoon.glow);
  });
});

describe("weather", () => {
  it("is deterministic per day", () => {
    const d = new Date(2026, 6, 3);
    expect(weatherForDay(d)).toBe(weatherForDay(new Date(2026, 6, 3)));
  });
  it("is deterministic per seed and always valid", () => {
    for (let s = 0; s < 20; s++) {
      const w = weatherFromSeed(s);
      expect(WEATHER_THEMES[w]).toBeTruthy();
      expect(weatherFromSeed(s)).toBe(w);
    }
  });
  it("themes carry a precip mode", () => {
    expect(weatherTheme("rain").precip).toBe("rain");
    expect(weatherTheme("snow").precip).toBe("snow");
    expect(weatherTheme("sunny").precip).toBe("none");
  });
});

describe("ambience architecture", () => {
  it("is OFF by default (no audio ships this sprint)", () => {
    expect(ambienceEnabled()).toBe(false);
  });
  it("chooses a scene deterministically from weather/time/persona", () => {
    expect(ambienceForScene({ weather: "rain", time: "afternoon" }).id).toBe("rain");
    expect(ambienceForScene({ weather: "sunny", time: "night" }).id).toBe("night-crickets");
    expect(ambienceForScene({ weather: "sunny", time: "afternoon", persona: "Writer" }).id).toBe("coffee-shop");
    expect(ambienceForScene({ weather: "sunny", time: "morning" }).id).toBe("birds");
    expect(ambienceForScene({ weather: "sunny", time: "afternoon" }).id).toBe("village");
  });
  it("every scene has a future src + volume", () => {
    for (const s of Object.values(AMBIENCE_SCENES)) {
      expect(s.src).toMatch(/^\/ambience\//);
      expect(s.volume).toBeGreaterThan(0);
      expect(s.volume).toBeLessThanOrEqual(1);
    }
  });
});
