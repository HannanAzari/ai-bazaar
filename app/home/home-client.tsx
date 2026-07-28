"use client";

import Link from "next/link";
import { Loader2, Trees, TriangleAlert } from "lucide-react";
import { BottomNav } from "@/components/nest/app-shell/bottom-nav";
import { DiscoveryFeed } from "@/components/nest/app-shell/discovery";
import { useDiscovery } from "@/components/nest/app-shell/use-discovery";

// M17 — Home is the discovery feed: a cozy, mobile-first vertical stream of Nests you
// can wander into. Own layout (not the padded chrome) so the feed is immersive and the
// only scroller; the persistent BottomNav still sits on top. Published Nests lead, with
// curated examples keeping it alive, and a "make your own" card closing the stream.
export function HomeClient() {
  const { items, loading, error } = useDiscovery();

  return (
    <>
      {/* No bottom reserve — the feed runs full-bleed to the viewport edge under the
          translucent BottomNav (each card lifts its own controls clear of the nav), so
          there's no empty cream gap between the last card and the nav. */}
      <div
        className="flex h-[100dvh] flex-col bg-parchment"
        style={{ paddingTop: "max(env(safe-area-inset-top), 0.5rem)" }}
      >
        <header className="flex-none px-4 pb-2">
          <div className="flex items-center justify-between gap-2">
            <h1 className="display text-xl leading-none">Wander cozy Nests</h1>
            {/* The village is the map behind the feed — one tap to explore it as a place. */}
            <Link href="/village" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-terracotta px-3 py-1.5 text-xs font-black text-parchment shadow-soft active:scale-95">
              <Trees className="size-4" /> Village
            </Link>
          </div>
        </header>
        {/* M23B — an empty feed used to be indistinguishable from a broken backend.
            Now Home says which one it is. */}
        {error ? (
          <div className="mx-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-white px-3 py-2.5">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-600" />
            <p className="text-[12px] leading-snug text-ink/70">
              <strong className="font-black text-rose-700">We couldn&rsquo;t load Nests.</strong> {error}
            </p>
          </div>
        ) : null}
        <div className="min-h-0 flex-1">
          {loading && items.length === 0 ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-ink/45">
              <Loader2 className="size-4 animate-spin" /> Finding cozy Nests…
            </div>
          ) : (
            <DiscoveryFeed items={items} />
          )}
        </div>
      </div>
      <BottomNav />
    </>
  );
}
