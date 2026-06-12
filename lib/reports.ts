import type { Report, ReportStatus, ReportTargetType } from "@/lib/types";

// Demo moderation store. Reports live in localStorage so the admin page is fully
// usable without a backend; production writes the same records to the Supabase
// `reports` table (see schema.sql).

const STORAGE_KEY = "ai-bazaar-reports";

export const reportStatusLabels: Record<ReportStatus, string> = {
  pending: "Pending",
  reviewed: "Reviewed",
  hidden: "Hidden",
  dismissed: "Dismissed",
};

export const reportTargetLabels: Record<ReportTargetType, string> = {
  house: "House",
  decoration: "Decoration",
  user: "User",
  guestbook: "Guestbook note",
};

function read(): Report[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as Report[];
  } catch {
    return [];
  }
}

function write(reports: Report[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  window.dispatchEvent(new Event("ai-bazaar-reports-changed"));
}

export function getReports(): Report[] {
  return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** File a new report (status starts "pending"). Returns the created record. */
export function fileReport(input: {
  targetType: ReportTargetType;
  targetRef: string;
  targetLabel: string;
  reason: string;
  targetId?: string;
}): Report {
  const report: Report = {
    id: `rpt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: "pending",
    createdAt: new Date().toISOString(),
    ...input,
  };
  write([report, ...read()]);
  return report;
}

export function setReportStatus(id: string, status: ReportStatus) {
  write(read().map((report) => (report.id === id ? { ...report, status } : report)));
}

/** Address/handle refs that an admin has hidden — used to soft-hide content. */
export function hiddenRefs(): Set<string> {
  return new Set(read().filter((report) => report.status === "hidden").map((report) => report.targetRef));
}
