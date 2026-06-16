"use client";

import { useEffect, useState } from "react";
import { Clock3, DoorOpen, Eye, MousePointerClick, Users } from "lucide-react";
import { loadHouse } from "@/lib/house-store";
import { getRepositories } from "@/lib/repos";
import { type CreatorInsights, computeCreatorInsights, formatDuration } from "@/lib/creator-insights";
import type { Shop } from "@/lib/types";
import { cn } from "@/lib/utils";

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white/70 p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-ink/40">{icon} {label}</p>
      <strong className="mt-1 block text-xl leading-tight">{value}</strong>
      {hint && <span className="text-[10px] font-bold text-ink/35">{hint}</span>}
    </div>
  );
}

/**
 * Creator Insights Dashboard V1 — house-wide visitor analytics for the owner.
 * Reads events through the mode-selected repository (durable in production,
 * localStorage in demo) and the saved house for object/room labels, then
 * recomputes whenever analytics or the room change.
 */
export function CreatorInsightsPanel({ shop }: { shop: Shop }) {
  const [insights, setInsights] = useState<CreatorInsights | null>(null);

  useEffect(() => {
    let active = true;
    const sync = () => {
      Promise.all([loadHouse(shop), getRepositories().events.list()])
        .then(([house, events]) => {
          if (active) setInsights(computeCreatorInsights(events, shop.id, house));
        })
        .catch(() => undefined);
    };
    sync();
    window.addEventListener("ai-bazaar-events-changed", sync);
    window.addEventListener("ai-bazaar-rooms-changed", sync);
    return () => {
      active = false;
      window.removeEventListener("ai-bazaar-events-changed", sync);
      window.removeEventListener("ai-bazaar-rooms-changed", sync);
    };
  }, [shop]);

  const hasData = insights && insights.totalVisits + insights.interactions + insights.uniqueVisitors > 0;
  const maxFunnel = insights ? Math.max(1, ...insights.funnel.map((step) => step.count)) : 1;

  return (
    <div className="mt-5 space-y-5 border-t border-ink/10 pt-5">
      {!hasData ? (
        <p className="rounded-2xl bg-white/60 p-5 text-center text-sm text-ink/50">
          No visits recorded yet. Share your address — visits, unique visitors, and the objects people open will appear here.
        </p>
      ) : insights ? (
        <>
          {/* Headline stats */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Stat icon={<Eye size={11} />} label="Total visits" value={String(insights.totalVisits)} />
            <Stat icon={<Users size={11} />} label="Unique visitors" value={String(insights.uniqueVisitors)} />
            <Stat icon={<DoorOpen size={11} />} label="Room entries" value={String(insights.roomEntries)} />
            <Stat icon={<Clock3 size={11} />} label="Avg session" value={formatDuration(insights.avgSessionDurationMs)} />
            <Stat icon={<MousePointerClick size={11} />} label="Interactions" value={String(insights.interactions)} hint={`${insights.conversion}% conversion`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Visitor funnel */}
            <div>
              <p className="eyebrow text-teal">Visitor funnel</p>
              <div className="mt-2 space-y-1.5">
                {insights.funnel.map((step) => (
                  <div key={step.key} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-xs font-bold text-ink/55">{step.label}</span>
                    <span className="h-5 rounded-full bg-terracotta/80" style={{ width: `${Math.round((step.count / maxFunnel) * 100)}%`, minWidth: step.count ? "1.25rem" : 0 }} />
                    <span className="text-xs font-black text-ink/70">{step.count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink/50">
                {insights.topRoom && <span>Top room: <strong className="text-ink/70">{insights.topRoom.name}</strong> ({insights.topRoom.entries})</span>}
                {insights.topDayOfWeek && <span>Busiest day: <strong className="text-ink/70">{insights.topDayOfWeek.day}</strong></span>}
              </div>
            </div>

            {/* Object ranking */}
            <div>
              <p className="eyebrow text-terracotta">Top objects · views · clicks · engagement</p>
              {insights.topObjects.length ? (
                <ol className="mt-2 space-y-1.5">
                  {insights.topObjects.slice(0, 6).map((object, index) => (
                    <li key={object.objectId} className="flex items-center gap-2 rounded-xl border border-ink/5 bg-white/70 px-3 py-2">
                      <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-black", index === 0 ? "bg-saffron text-ink" : "bg-ink/5 text-ink/50")}>{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-xs font-bold">{object.label}</span>
                      <span className="shrink-0 text-[11px] font-bold text-ink/45">{object.views}v · {object.clicks}c · {object.engagement}%</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 rounded-xl bg-white/60 p-3 text-xs text-ink/45">No object interactions yet.</p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
