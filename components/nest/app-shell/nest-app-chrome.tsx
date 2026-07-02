"use client";

import { BottomNav } from "@/components/nest/app-shell/bottom-nav";

// Wraps every app-shell screen (Home · Explore · Create · Updates · /@handle):
// a scrollable content column that clears the notch on top and leaves room for the
// persistent BottomNav at the bottom (plus the iOS home indicator). The old V1
// SiteHeader hides itself on these routes, so this owns the full frame.
export function NestAppChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-parchment">
      <div
        className="mx-auto w-full max-w-md px-4"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 0.75rem)",
          // Clear the floating BottomNav (≈64px) + the home indicator.
          paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
