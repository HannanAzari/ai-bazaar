"use client";

import Link from "next/link";
import { Trees } from "lucide-react";
import { BottomNav } from "@/components/nest/app-shell/bottom-nav";
import { DiscoveryFeed } from "@/components/nest/app-shell/discovery";
import { useDiscovery } from "@/components/nest/app-shell/use-discovery";

// M17 — Home is the discovery feed: a cozy, mobile-first vertical stream of Nests you
// can wander into. Own layout (not the padded chrome) so the feed is immersive and the
// only scroller; the persistent BottomNav still sits on top. Published Nests lead, with
// curated examples keeping it alive, and a "make your own" card closing the stream.
export function HomeClient() {
  const { items } = useDiscovery();

  return (
    <>
      <div
        className="flex h-[100dvh] flex-col bg-parchment"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 0.5rem)",
          paddingBottom: "calc(4.75rem + env(safe-area-inset-bottom))",
        }}
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
        <div className="min-h-0 flex-1">
          <DiscoveryFeed items={items} />
        </div>
      </div>
      <BottomNav />
    </>
  );
}
