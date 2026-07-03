"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, DoorOpen, Home, MapPin, Sparkles } from "lucide-react";
import type { House } from "@/lib/nest-house";
import { houseInitial } from "@/lib/nest-house";
import { followerCount, onSocialChanged } from "@/lib/nest-social";
import { HouseExterior } from "@/components/nest/village/house-exterior";
import { SceneBackdrop } from "@/components/nest/village/scene-backdrop";
import { DoorTransition } from "@/components/nest/village/enter-transition";
import { useAtmosphere } from "@/components/nest/village/use-atmosphere";

// M19.1 — the House Front, richer: creator avatar · name · bio · current Nest · followers
// · nests · online indicator · Enter — under a live sky (time of day + weather). Airbnb
// arrival page + Animal Crossing house. Reused by the village overlay and /@handle.

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
  const { sky, wx, time } = useAtmosphere();
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

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <SceneBackdrop sky={sky} wx={wx} birds className="absolute inset-0" />

      {/* top bar — back + presence + time */}
      <div className="relative z-10 flex items-center justify-between p-3">
        {onBack ? (
          <button onClick={onBack} className="inline-flex items-center gap-1 rounded-full bg-white/85 px-3 py-1.5 text-xs font-bold text-ink/70 shadow-soft backdrop-blur active:scale-95">
            <ChevronLeft className="size-4" /> {backLabel}
          </button>
        ) : <span />}
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-white/75 px-2.5 py-1.5 text-[11px] font-bold text-ink/55 shadow-soft backdrop-blur">{sky.label} · {wx.label}</span>
          {house.online ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-xs font-bold text-meadow-shade shadow-soft backdrop-blur">
              <span className="size-2 rounded-full bg-meadow-shade" /> Home
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-1.5 text-xs font-bold text-ink/40 shadow-soft backdrop-blur">
              <span className="size-2 rounded-full bg-ink/25" /> Out
            </span>
          )}
        </div>
      </div>

      {/* the house */}
      <div className="relative z-10 flex flex-col items-center px-5">
        <div className="nest-approach relative w-full max-w-[300px]">
          <HouseExterior house={house} className="w-full" glow={sky.glow} night={sky.night} />
          {onPrev ? <NavArrow dir="prev" onClick={onPrev} /> : null}
          {onNext ? <NavArrow dir="next" onClick={onNext} /> : null}
        </div>

        {/* door plate — avatar + name */}
        <div className="-mt-2 flex items-center gap-3 rounded-3xl border border-timber/15 bg-white/90 px-4 py-3 shadow-lift backdrop-blur">
          <span className="grid size-11 shrink-0 place-items-center rounded-full font-black text-parchment shadow-soft" style={{ background: house.style.roof }}>
            {houseInitial(house)}
          </span>
          <div className="min-w-0">
            {house.handle ? (
              <Link href={`/@${house.handle}`} className="block truncate font-black text-ink hover:underline">{house.name}</Link>
            ) : (
              <p className="truncate font-black text-ink">{house.name}</p>
            )}
            <p className="flex items-center gap-1 truncate text-xs text-ink/50">
              <MapPin className="size-3" /> {house.style.label}
              {house.handle ? <span className="text-ink/35">· @{house.handle}</span> : null}
            </p>
          </div>
        </div>

        {/* bio */}
        {house.bio ? <p className="mt-3 max-w-xs text-center text-sm text-ink/70">{house.bio}</p> : null}

        {/* stats — followers · nests · presence */}
        {house.isReal ? (
          <div className="mt-3 flex items-center gap-4 rounded-2xl bg-white/70 px-4 py-2 shadow-soft backdrop-blur">
            <Stat value={followers} label={followers === 1 ? "Follower" : "Followers"} />
            {house.nestCount != null ? <Stat value={house.nestCount} label={house.nestCount === 1 ? "Nest" : "Nests"} /> : null}
            <div className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${house.online ? "bg-meadow-shade" : "bg-ink/25"}`} />
              <span className="text-xs font-bold text-ink/55">{house.online ? "Online" : "Away"}</span>
            </div>
          </div>
        ) : null}

        {/* latest activity peek */}
        {house.latestNestTitle ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-ink/55 backdrop-blur">
            <Sparkles className="size-3 text-terracotta" /> Now showing: {house.latestNestTitle}
          </p>
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

      {/* faint time-of-day note in the corner */}
      <span className="pointer-events-none absolute bottom-2 right-3 z-10 text-[10px] font-bold uppercase tracking-wider text-white/40">{time}</span>
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
