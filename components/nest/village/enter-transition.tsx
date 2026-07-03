"use client";

import { useEffect } from "react";
import type { HouseStyle } from "@/lib/nest-house";

// M19 — the "step inside" moment. You don't teleport into a Nest; a door opens, warm
// light floods out, and then we fade in. A small thing that turns "load the page" into
// "cross a threshold." Calls `onDone` when the animation finishes (the caller then
// navigates into the Nest).
export function DoorTransition({ style, onDone, label = "Stepping inside…" }: { style: HouseStyle; onDone: () => void; label?: string }) {
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(onDone, reduce ? 120 : 900);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-hidden bg-[#241811]" role="status" aria-label={label}>
      {/* warm light flooding out from behind the opening door */}
      <div
        className="nest-door-flood absolute inset-0"
        style={{ background: `radial-gradient(circle at 50% 55%, ${style.glow} 0%, ${style.roof} 45%, transparent 75%)` }}
      />
      {/* two door leaves swinging open */}
      <div className="relative flex h-64 w-40 items-stretch overflow-hidden rounded-t-[3rem]" style={{ boxShadow: `0 0 60px 8px ${style.glow}55` }}>
        <div className="nest-door-open h-full w-1/2" style={{ background: style.door, transformOrigin: "left center" }} />
        <div className="nest-door-open h-full w-1/2" style={{ background: style.door, transformOrigin: "right center" }} />
        <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: style.glow }} />
      </div>
      <p className="absolute bottom-16 text-sm font-bold text-white/80">{label}</p>
    </div>
  );
}
