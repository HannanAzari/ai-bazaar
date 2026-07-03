"use client";

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
          <p className="eyebrow text-terracotta">Nestudio</p>
          <h1 className="display text-2xl leading-tight">Wander cozy Nests</h1>
        </header>
        <div className="min-h-0 flex-1 px-3">
          <DiscoveryFeed items={items} />
        </div>
      </div>
      <BottomNav />
    </>
  );
}
