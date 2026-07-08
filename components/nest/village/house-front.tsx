"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, DoorOpen, Home } from "lucide-react";
import type { House } from "@/lib/nest-house";
import { houseInitial } from "@/lib/nest-house";
import { followerCount, onSocialChanged } from "@/lib/nest-social";
import { HouseExterior } from "@/components/nest/village/house-exterior";
import { SceneBackdrop } from "@/components/nest/village/scene-backdrop";
import { DoorTransition } from "@/components/nest/village/enter-transition";
import { useAtmosphere } from "@/components/nest/village/use-atmosphere";

// Beta Polish 3 — the arrival. Stripped to what matters (creator · followers · nests ·
// Enter), a house that feels alive under softer light + a grounded shadow, and
// Instagram-Stories swiping between houses (arrows still work). Reused by the village
// overlay and /@handle.

const SWIPE_THRESHOLD = 55;

export function HouseFront({
  house,
  onBack,
  onPrev,
  onNext,
  backLabel = "Back to village",
  className = "",
}: {
  house: House;
  onBack?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  backLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const { sky, wx } = useAtmosphere();
  const [entering, setEntering] = useState(false);
  const [followers, setFollowers] = useState(0);
  const canEnter = !!house.nestHref;

  useEffect(() => {
    if (!house.ownerId) { setFollowers(0); return; }
    const id = house.ownerId;
    const refresh = () => setFollowers(followerCount(id));
    refresh();
    return onSocialChanged(refresh);
  }, [house.ownerId]);

  // ── Instagram-Stories swipe (horizontal) — arrows still work ─────────────────
  const start = useRef<{ x: number; y: number } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e: React.PointerEvent) {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    if (dx < 0) onNext?.();
    else onPrev?.();
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      style={{ touchAction: "pan-y" }}
    >
      <SceneBackdrop sky={sky} wx={wx} birds className="absolute inset-0" />

      {/* top bar — back + a single quiet atmosphere label */}
      <div className="relative z-10 flex items-center justify-between p-3">
        {onBack ? (
          <button onClick={onBack} className="inline-flex items-center gap-1 rounded-full bg-white/85 px-3 py-1.5 text-xs font-bold text-ink/70 shadow-soft backdrop-blur active:scale-95">
            <ChevronLeft className="size-4" /> {backLabel}
          </button>
        ) : <span />}
        <span className="rounded-full bg-white/70 px-2.5 py-1.5 text-[11px] font-bold text-ink/55 shadow-soft backdrop-blur">{sky.label} · {wx.label}</span>
      </div>

      {/* the house — settles in on each swipe (keyed), then breathes gently */}
      <div className="relative z-10 flex flex-col items-center px-5">
        <div key={house.id} className="nest-approach relative w-full max-w-[330px]">
          {/* grounded shadow so the house sits on the earth */}
          <div className="pointer-events-none absolute inset-x-[16%] bottom-[8%] h-[7%] rounded-[50%] bg-[#241811]/25 blur-lg" />
          <div className="nest-idle relative">
            {/* soft pooled light behind the house */}
            <div
              className="pointer-events-none absolute inset-x-[6%] top-[10%] bottom-[14%] rounded-[45%] blur-2xl"
              style={{ background: sky.glow, opacity: sky.night ? 0.32 : 0.22 }}
            />
            <HouseExterior house={house} className="relative w-full" glow={sky.glow} night={sky.night} />
          </div>
          {onPrev ? <NavArrow dir="prev" onClick={onPrev} /> : null}
          {onNext ? <NavArrow dir="next" onClick={onNext} /> : null}
        </div>

        {/* door plate — avatar + name */}
        <div className="-mt-1 flex items-center gap-3 rounded-3xl border border-timber/15 bg-white/90 px-4 py-3 shadow-lift backdrop-blur">
          <span className="grid size-11 shrink-0 place-items-center rounded-full font-black text-parchment shadow-soft" style={{ background: house.style.roof }}>
            {houseInitial(house)}
          </span>
          <div className="min-w-0">
            {house.handle ? (
              <Link href={`/@${house.handle}`} className="block truncate font-black text-ink hover:underline">{house.name}</Link>
            ) : (
              <p className="truncate font-black text-ink">{house.name}</p>
            )}
            <p className="truncate text-xs text-ink/50">{house.handle ? `@${house.handle}` : house.style.label}</p>
          </div>
        </div>

        {/* bio */}
        {house.bio ? <p className="mt-3 max-w-xs text-center text-sm text-ink/70">{house.bio}</p> : null}

        {/* stats — followers · nests */}
        {house.isReal ? (
          <div className="mt-3 flex items-center gap-5 rounded-2xl bg-white/70 px-5 py-2 shadow-soft backdrop-blur">
            <Stat value={followers} label={followers === 1 ? "Follower" : "Followers"} />
            {house.nestCount != null ? <Stat value={house.nestCount} label={house.nestCount === 1 ? "Nest" : "Nests"} /> : null}
          </div>
        ) : null}

        {/* enter */}
        <div className="mt-5 w-full max-w-xs">
          {canEnter ? (
            <button onClick={() => setEntering(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-terracotta px-5 py-3.5 text-base font-black text-parchment shadow-lift transition active:scale-95">
              <DoorOpen className="size-5" /> Enter Nest
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-timber/30 bg-white/60 px-5 py-3.5 text-center text-sm text-ink/50">
              <Home className="size-4" /> {house.isReal ? "This creator hasn't opened their Nest yet." : "Nobody's moved in here yet."}
            </div>
          )}
        </div>
      </div>

      {entering && house.nestHref ? (
        <DoorTransition style={house.style} mode="enter" onDone={() => router.push(house.nestHref!)} label={`Stepping into ${house.name}'s Nest…`} />
      ) : null}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-black leading-none text-ink">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-ink/45">{label}</p>
    </div>
  );
}

function NavArrow({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      aria-label={dir === "prev" ? "Previous house" : "Next house"}
      className={`absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink/70 shadow-soft backdrop-blur transition active:scale-90 ${dir === "prev" ? "-left-1" : "-right-1"}`}
    >
      <Icon className="size-5" />
    </button>
  );
}
