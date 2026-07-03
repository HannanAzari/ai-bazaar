"use client";

import { BottomNav } from "@/components/nest/app-shell/bottom-nav";

// M17.1 — an app SCREEN, not a long document. Each tab (Explore · Create · Notifications ·
// Profile) fills exactly one phone viewport: a fixed-height frame with an internal scroll
// area, so it feels like Instagram/Airbnb (entering rooms through doors) rather than a
// scrolling webpage. The persistent BottomNav sits on top. (Home owns its own feed layout.)
export function NestAppChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div
        className="flex h-[100dvh] flex-col bg-parchment"
        style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}
      >
        <div
          className="mx-auto min-h-0 w-full max-w-md flex-1 overflow-y-auto px-4 [scrollbar-width:none]"
          style={{ paddingBottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </div>
      <BottomNav />
    </>
  );
}
