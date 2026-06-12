"use client";

import { useEffect, useState } from "react";
import { EyeOff, Flag } from "lucide-react";
import { getReports, reportStatusLabels, reportTargetLabels, setReportStatus } from "@/lib/reports";
import { eventCounts, eventLabels } from "@/lib/events";
import type { EventType, Report, ReportStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusStyles: Record<ReportStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  reviewed: "bg-teal/15 text-teal",
  hidden: "bg-ink text-white",
  dismissed: "bg-ink/10 text-ink/50",
};

const statusOrder: ReportStatus[] = ["pending", "reviewed", "hidden", "dismissed"];

const zeroCounts = () =>
  Object.fromEntries((Object.keys(eventLabels) as EventType[]).map((type) => [type, 0])) as Record<EventType, number>;

export function ModerationClient() {
  const [reports, setReports] = useState<Report[]>([]);
  // Start zeroed so server and first client render match; real counts load after mount.
  const [counts, setCounts] = useState<Record<EventType, number>>(zeroCounts);

  useEffect(() => {
    const sync = () => {
      setReports(getReports());
      setCounts(eventCounts());
    };
    sync();
    window.addEventListener("ai-bazaar-reports-changed", sync);
    window.addEventListener("ai-bazaar-events-changed", sync);
    return () => {
      window.removeEventListener("ai-bazaar-reports-changed", sync);
      window.removeEventListener("ai-bazaar-events-changed", sync);
    };
  }, []);

  const update = (id: string, status: ReportStatus) => {
    setReportStatus(id, status);
    setReports(getReports());
  };

  const pendingCount = reports.filter((report) => report.status === "pending").length;

  return (
    <div className="mt-10 space-y-12">
      {/* Basic activity counts */}
      <section>
        <h2 className="display text-2xl">Activity at a glance</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {(Object.keys(eventLabels) as EventType[]).map((type) => (
            <div key={type} className="card rounded-2xl p-4">
              <p className="display text-3xl">{counts[type] ?? 0}</p>
              <p className="mt-1 text-xs font-bold text-ink/50">{eventLabels[type]}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink/40">Counts come from this browser&apos;s activity. In production they aggregate from the events table.</p>
      </section>

      {/* Reports queue */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="display text-2xl">Reports</h2>
          <span className="rounded-full bg-terracotta/10 px-3 py-1 text-xs font-bold text-terracotta">{pendingCount} pending</span>
        </div>

        {reports.length === 0 ? (
          <div className="card mt-4 flex flex-col items-center rounded-3xl p-10 text-center">
            <Flag className="text-ink/30" />
            <p className="mt-3 text-ink/55">No reports yet. When a visitor reports a house, item, or owner, it lands here.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {reports.map((report) => (
              <article key={report.id} className={cn("card rounded-2xl p-4", report.status === "hidden" && "opacity-70")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-ink/50">{reportTargetLabels[report.targetType]}</span>
                      <span className="truncate font-black">{report.targetLabel}</span>
                      {report.status === "hidden" && <EyeOff size={14} className="text-ink/50" />}
                    </div>
                    <p className="mt-1 text-sm text-ink/60">{report.reason}</p>
                    <p className="mt-1 text-[11px] text-ink/35">{report.targetRef} · {new Date(report.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-bold", statusStyles[report.status])}>{reportStatusLabels[report.status]}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-ink/10 pt-3">
                  {statusOrder.map((status) => (
                    <button
                      key={status}
                      onClick={() => update(report.id, status)}
                      disabled={report.status === status}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-bold transition disabled:opacity-40",
                        report.status === status ? "border-transparent bg-ink/5 text-ink/40" : "border-ink/15 text-ink/60 hover:border-terracotta hover:text-terracotta",
                      )}
                    >
                      {reportStatusLabels[status]}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
