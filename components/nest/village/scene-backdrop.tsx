"use client";

import type { SkyTheme, WeatherTheme } from "@/lib/nest-atmosphere";

// M19.1 — the storybook sky the village + houses sit against, now alive with a time of
// day and a weather. Pure CSS/SVG, no art assets, deterministic particle positions
// (no Math.random → hydration-safe). Restraint over spectacle — a Ghibli town at dusk,
// not a weather demo.

// Deterministic 0..1 from an index (a tiny hash — never Math.random).
function rnd(i: number, salt = 1): number {
  const x = Math.sin((i + 1) * 12.9898 * salt) * 43758.5453;
  return x - Math.floor(x);
}

const STARS = Array.from({ length: 26 }, (_, i) => ({
  left: rnd(i, 1) * 100,
  top: rnd(i, 2) * 46,
  size: 1 + rnd(i, 3) * 1.6,
  delay: rnd(i, 4) * 4,
}));

const RAIN = Array.from({ length: 34 }, (_, i) => ({
  left: rnd(i, 5) * 100,
  delay: rnd(i, 6) * 1.1,
  dur: 0.7 + rnd(i, 7) * 0.5,
  h: 12 + rnd(i, 8) * 10,
}));

const SNOW = Array.from({ length: 26 }, (_, i) => ({
  left: rnd(i, 9) * 100,
  delay: rnd(i, 10) * 5,
  dur: 5 + rnd(i, 11) * 4,
  size: 3 + rnd(i, 12) * 3,
  drift: (rnd(i, 13) - 0.5) * 40,
}));

export function SceneBackdrop({
  sky,
  wx,
  className = "",
  birds = false,
}: {
  sky: SkyTheme;
  wx: WeatherTheme;
  className?: string;
  /** Show a couple of birds drifting across (skipped at night / in rain by the caller). */
  birds?: boolean;
}) {
  const showBirds = birds && !sky.night && wx.precip === "none";
  return (
    <div className={`pointer-events-none overflow-hidden ${className}`} aria-hidden>
      {/* sky */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${sky.sky[0]}, ${sky.sky[1]} 55%, ${sky.sky[2]})` }} />

      {/* stars (night) */}
      {sky.night
        ? STARS.map((s, i) => (
            <span
              key={i}
              className="nest-twinkle absolute rounded-full bg-white"
              style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }}
            />
          ))
        : null}

      {/* sun / moon */}
      <div
        className="absolute rounded-full blur-2xl"
        style={{ left: `${sky.discPos.x}%`, top: `${sky.discPos.y}%`, width: 150, height: 150, background: sky.discGlow, opacity: 0.55, transform: "translate(-50%,-50%)" }}
      />
      <div
        className="absolute rounded-full"
        style={{ left: `${sky.discPos.x}%`, top: `${sky.discPos.y}%`, width: sky.night ? 52 : 60, height: sky.night ? 52 : 60, background: sky.disc, boxShadow: `0 0 26px 6px ${sky.discGlow}`, transform: "translate(-50%,-50%)" }}
      >
        {sky.night ? <span className="absolute right-2 top-2 size-8 rounded-full" style={{ background: sky.sky[2], opacity: 0.5 }} /> : null}
      </div>

      {/* clouds — density follows the weather */}
      <div className="nest-drift absolute left-[8%] top-[16%] h-8 rounded-full bg-white/70 blur-md" style={{ width: 96, opacity: 0.35 + wx.clouds * 0.55 }} />
      <div className="nest-drift absolute right-[10%] top-[26%] h-6 rounded-full bg-white/60 blur-md" style={{ width: 64, opacity: 0.3 + wx.clouds * 0.55, animationDelay: "-6s" }} />
      {wx.clouds > 0.5 ? (
        <div className="nest-drift absolute left-[42%] top-[10%] h-7 rounded-full bg-white/70 blur-md" style={{ width: 110, opacity: wx.clouds * 0.6, animationDelay: "-11s" }} />
      ) : null}

      {/* birds */}
      {showBirds ? (
        <div className="nest-birds absolute top-[22%]" style={{ left: "-10%" }}>
          <Bird /> <span className="inline-block w-4" /> <Bird delay />
        </div>
      ) : null}

      {/* rolling hills, re-lit by the sky */}
      <svg viewBox="0 0 400 200" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-2/3 w-full">
        <path d="M0 130 Q100 96 200 124 T400 118 V200 H0 Z" fill={sky.hills[0]} opacity="0.92" />
        <path d="M0 156 Q120 124 240 152 T400 150 V200 H0 Z" fill={sky.hills[1]} />
        <path d="M0 182 Q140 164 280 180 T400 178 V200 H0 Z" fill={sky.hills[2]} />
      </svg>

      {/* precipitation */}
      {wx.precip === "rain"
        ? RAIN.map((d, i) => (
            <span
              key={i}
              className="nest-rain absolute top-[-6%] w-px bg-white/45"
              style={{ left: `${d.left}%`, height: d.h, animationDelay: `${d.delay}s`, animationDuration: `${d.dur}s` }}
            />
          ))
        : null}
      {wx.precip === "snow"
        ? SNOW.map((d, i) => (
            <span
              key={i}
              className="nest-snow absolute top-[-4%] rounded-full bg-white/85"
              style={{ left: `${d.left}%`, width: d.size, height: d.size, animationDelay: `${d.delay}s`, animationDuration: `${d.dur}s`, ["--drift" as string]: `${d.drift}px` }}
            />
          ))
        : null}

      {/* overcast + time-of-day colour wash tie the light together */}
      {wx.overcast !== "rgba(255,255,255,0)" ? <div className="absolute inset-0" style={{ background: wx.overcast }} /> : null}
      <div className="absolute inset-0" style={{ background: sky.wash }} />
    </div>
  );
}

function Bird({ delay }: { delay?: boolean }) {
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" className={delay ? "nest-flap inline-block" : "nest-flap inline-block"} style={delay ? { animationDelay: "-0.3s" } : undefined} aria-hidden>
      <path d="M1 6 Q5 1 9 5 Q13 1 17 6" fill="none" stroke="#4a3b2c" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
