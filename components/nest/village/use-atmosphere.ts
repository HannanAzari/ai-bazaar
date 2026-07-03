"use client";

import { useEffect, useState } from "react";
import {
  skyTheme,
  timeOfDay,
  weatherForDay,
  weatherTheme,
  type SkyTheme,
  type TimeOfDay,
  type Weather,
  type WeatherTheme,
} from "@/lib/nest-atmosphere";

// M19.1 — the village's current time + weather. Time comes from the visitor's clock;
// weather is a deterministic daily rotation (one sky for the whole village). Computed
// AFTER mount so SSR + first client render agree (default afternoon/clear) — no
// hydration mismatch — then it settles to the real sky.
export function useAtmosphere(): {
  time: TimeOfDay;
  weather: Weather;
  sky: SkyTheme;
  wx: WeatherTheme;
  mounted: boolean;
} {
  const [state, setState] = useState<{ time: TimeOfDay; weather: Weather; mounted: boolean }>({
    time: "afternoon",
    weather: "sunny",
    mounted: false,
  });

  useEffect(() => {
    const now = new Date();
    setState({ time: timeOfDay(now.getHours()), weather: weatherForDay(now), mounted: true });
  }, []);

  return { time: state.time, weather: state.weather, mounted: state.mounted, sky: skyTheme(state.time), wx: weatherTheme(state.weather) };
}
