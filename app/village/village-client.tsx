"use client";

import { useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { BottomNav } from "@/components/nest/app-shell/bottom-nav";
import { VillageScene } from "@/components/nest/village/village-scene";
import { HouseFront } from "@/components/nest/village/house-front";
import { useVillage } from "@/components/nest/village/use-village";
import { neighborOf } from "@/lib/nest-village";

// M19 — the Village tab. You descend into a cozy hex neighborhood, tap a house to walk
// up to it, then step through the door into a Nest. Own immersive layout (like Home);
// the persistent BottomNav sits on top.
export function VillageClient() {
  const { village, realCount } = useVillage();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId ? village.houses.find((h) => h.id === selectedId) ?? null : null;

  return (
    <>
      <div
        className="relative flex h-[100dvh] flex-col bg-parchment"
        style={{ paddingBottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
      >
        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-4" style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}>
          <div className="pointer-events-auto rounded-2xl bg-white/80 px-3 py-2 shadow-soft backdrop-blur">
            <p className="eyebrow text-terracotta">Nestudio</p>
            <h1 className="display text-xl leading-none">The Village</h1>
            <p className="mt-1 text-[11px] text-ink/55">{realCount} creator{realCount === 1 ? "" : "s"} · tap a house to visit</p>
          </div>
          <Link href="/explore" className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-ink/60 shadow-soft backdrop-blur">
            <Info className="size-3.5" /> Search instead
          </Link>
        </header>

        <div className="min-h-0 flex-1">
          <VillageScene village={village} onSelect={(h) => setSelectedId(h.id)} />
        </div>
      </div>

      {/* Arrival overlay — walking up to the selected house. */}
      {selected ? (
        <div className="nest-fade fixed inset-0 z-50 bg-parchment" style={{ paddingBottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}>
          <HouseFront
            house={selected}
            className="h-full"
            onBack={() => setSelectedId(null)}
            onPrev={() => setSelectedId(neighborOf(village, selected.id, -1)?.id ?? null)}
            onNext={() => setSelectedId(neighborOf(village, selected.id, 1)?.id ?? null)}
          />
        </div>
      ) : null}

      <BottomNav />
    </>
  );
}
