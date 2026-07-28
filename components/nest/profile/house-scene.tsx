"use client";

import type { House } from "@/lib/nest-house";
import { HouseExterior } from "@/components/nest/village/house-exterior";
import { SceneBackdrop } from "@/components/nest/village/scene-backdrop";
import { useAtmosphere } from "@/components/nest/village/use-atmosphere";

// Day 3.3 — the House scene, shared by the public @handle profile and the creator's own
// Profile so both look the same. The house is bottom-anchored so it visibly SITS ON THE
// GROUND rather than floating in sky, and the sky above it is deliberately shallow so the
// scene coexists with the identity box inside one viewport.
export function HouseScene({ house, className = "", footer }: { house: House; className?: string; footer?: React.ReactNode }) {
  const { sky, wx } = useAtmosphere();

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-timber/15 ${className}`}>
      <SceneBackdrop sky={sky} wx={wx} birds className="absolute inset-0" />

      {/* bottom-anchored: the ground line is the floor of the box. The house is scaled to
          the box so the sky above it stays shallow instead of leaving it adrift. */}
      <div className="relative z-10 flex h-full items-end justify-center px-4 pb-3">
        <div key={house.id} className="nest-approach relative w-full max-w-[300px]">
          {/* contact shadow — what makes it read as standing on the earth */}
          <div className="pointer-events-none absolute inset-x-[14%] bottom-[6%] h-[7%] rounded-[50%] bg-[#241811]/25 blur-lg" />
          <div className="nest-idle relative">
            <div
              className="pointer-events-none absolute inset-x-[6%] top-[12%] bottom-[14%] rounded-[45%] blur-2xl"
              style={{ background: sky.glow, opacity: sky.night ? 0.32 : 0.22 }}
            />
            <HouseExterior house={house} className="relative w-full" glow={sky.glow} night={sky.night} />
          </div>
        </div>
      </div>

      {footer ? <div className="absolute inset-x-0 bottom-0 z-20 p-2">{footer}</div> : null}
    </div>
  );
}
