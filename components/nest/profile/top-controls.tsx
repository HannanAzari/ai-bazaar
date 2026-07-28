"use client";

import { ChevronLeft } from "lucide-react";
import { useAtmosphere } from "@/components/nest/village/use-atmosphere";

// Day 3.3 — minimal top controls shared by both profiles: a back affordance and the
// weather/time pill. No page title (the identity box below already says whose place this is).
//
// M23B §2 — `action` is the owner-only slot. The creator's own Profile passes the
// Settings gear; the public Profile passes nothing, so on someone else's page the gear
// is not merely hidden, it is never rendered.
export function TopControls({
  onBack,
  backLabel = "The village",
  action,
}: {
  onBack?: () => void;
  backLabel?: string;
  action?: React.ReactNode;
}) {
  const { sky, wx } = useAtmosphere();
  return (
    <div className="flex items-center justify-between gap-2">
      {onBack ? (
        <button
          onClick={onBack}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-white/85 px-3 text-xs font-bold text-ink/70 shadow-soft backdrop-blur active:scale-95"
        >
          <ChevronLeft className="size-4" /> {backLabel}
        </button>
      ) : <span />}
      <span className="flex items-center gap-2">
        <span className="rounded-full bg-white/70 px-2.5 py-1.5 text-[11px] font-bold text-ink/55 shadow-soft backdrop-blur">
          {sky.label} · {wx.label}
        </span>
        {action}
      </span>
    </div>
  );
}
