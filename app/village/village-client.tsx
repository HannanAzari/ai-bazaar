"use client";
import { safeTop, z } from "@/lib/nest-layers";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Volume2 } from "lucide-react";
import { BottomNav } from "@/components/nest/app-shell/bottom-nav";
import { VillageScene } from "@/components/nest/village/village-scene";
import { HouseFront } from "@/components/nest/village/house-front";
import { useVillage } from "@/components/nest/village/use-village";
import { useAtmosphere } from "@/components/nest/village/use-atmosphere";
import { neighborOf } from "@/lib/nest-village";
import { ambienceForScene, ambienceEnabled } from "@/lib/nest-ambience";

// M19.1 — the Village tab, now cinematic + atmospheric. Descend into a hex neighborhood
// under a live sky; tapping a house zooms the camera toward it (the neighborhood softens)
// before the arrival panel rises. Own immersive layout; BottomNav sits on top.
export function VillageClient() {
  const { village, realCount } = useVillage();
  const atmosphere = useAtmosphere();
  const [zoomingId, setZoomingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const selected = selectedId ? village.houses.find((h) => h.id === selectedId) ?? null : null;

  function open(id: string) {
    if (timer.current) clearTimeout(timer.current);
    setZoomingId(id); // camera pushes toward the house
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    timer.current = setTimeout(() => setSelectedId(id), reduce ? 0 : 440);
  }
  function close() {
    if (timer.current) clearTimeout(timer.current);
    setSelectedId(null);
    setZoomingId(null); // camera eases back out
  }
  function go(dir: 1 | -1) {
    if (!selected) return;
    const next = neighborOf(village, selected.id, dir);
    if (next) { setSelectedId(next.id); setZoomingId(next.id); }
  }

  const ambience = ambienceForScene({ weather: atmosphere.weather, time: atmosphere.time, persona: selected?.persona });

  return (
    <>
      {/* Full-bleed: the curved ground runs to the viewport edge under the translucent
          nav — no cream gap between the world and the nav. */}
      <div className="relative flex h-[100dvh] flex-col bg-parchment">
        <header className={`pointer-events-none absolute inset-x-0 top-0 ${z.chrome} flex items-start justify-between p-4`} style={{ paddingTop: safeTop() }}>
          <div className="pointer-events-auto rounded-2xl bg-white/80 px-3 py-2 shadow-soft backdrop-blur">
            <p className="eyebrow text-terracotta">Nestudio</p>
            <h1 className="display text-xl leading-none">The Village</h1>
            <p className="mt-1 text-[11px] text-ink/55">{atmosphere.sky.label} · {atmosphere.wx.label} · {realCount} creator{realCount === 1 ? "" : "s"}</p>
          </div>
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <Link href="/explore" className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-ink/60 shadow-soft backdrop-blur">
              <Search className="size-3.5" /> Search
            </Link>
            {ambienceEnabled() ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-ink/60 shadow-soft backdrop-blur">
                <Volume2 className="size-3.5" /> {ambience.label}
              </span>
            ) : null}
          </div>
        </header>

        <div className="min-h-0 flex-1">
          <VillageScene village={village} onSelect={(h) => open(h.id)} sky={atmosphere.sky} wx={atmosphere.wx} zoomingId={zoomingId} />
        </div>
      </div>

      {/* Arrival overlay — walking up to the selected house. */}
      {selected ? (
        <div className={`nest-fade fixed inset-0 ${z.modal} bg-parchment`}>
          <HouseFront
            house={selected}
            className="h-full"
            onBack={close}
            onPrev={() => go(-1)}
            onNext={() => go(1)}
          />
        </div>
      ) : null}

      <BottomNav />
    </>
  );
}
