"use client";

import { useEffect } from "react";
import type { HouseStyle } from "@/lib/nest-house";

// M19.1 — crossing the threshold. Entering: the door opens, warm light floods out, and
// the camera pushes gently forward before we fade into the Nest. Exiting: the door
// closes back over the light. A few hundred ms, but it turns "load the page" into
// "step inside" / "step back out." Calls `onDone` when finished; respects reduced motion.
export function DoorTransition({
  style,
  onDone,
  mode = "enter",
  label,
}: {
  style: HouseStyle;
  onDone: () => void;
  mode?: "enter" | "exit";
  label?: string;
}) {
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(onDone, reduce ? 120 : mode === "enter" ? 1000 : 760);
    return () => clearTimeout(t);
  }, [onDone, mode]);

  const entering = mode === "enter";
  const doorAnim = entering ? "nest-door-open" : "nest-door-close";
  const text = label ?? (entering ? "Stepping inside…" : "Heading out…");

  return (
    // Fade the overlay in so entering/leaving eases in rather than cutting to black.
    <div className="nest-fade fixed inset-0 z-[70] grid place-items-center overflow-hidden bg-[#241811]" role="status" aria-label={text}>
      {/* warm light flooding out from behind the door */}
      <div
        className={entering ? "nest-door-flood absolute inset-0" : "absolute inset-0"}
        style={{ background: `radial-gradient(circle at 50% 55%, ${style.glow} 0%, ${style.roof} 45%, transparent 75%)`, opacity: entering ? undefined : 0.7 }}
      />
      {/* the door — pushes forward (enter) as it opens */}
      <div
        className={entering ? "nest-cam-forward relative flex h-64 w-40 items-stretch overflow-hidden rounded-t-[3rem]" : "relative flex h-64 w-40 items-stretch overflow-hidden rounded-t-[3rem]"}
        style={{ boxShadow: `0 0 60px 8px ${style.glow}55` }}
      >
        <div className={`${doorAnim} h-full w-1/2`} style={{ background: style.door, transformOrigin: "left center" }} />
        <div className={`${doorAnim} h-full w-1/2`} style={{ background: style.door, transformOrigin: "right center" }} />
        <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: style.glow }} />
      </div>
      <p className="absolute bottom-16 text-sm font-bold text-white/80">{text}</p>
    </div>
  );
}
