"use client";

import { useState } from "react";
import { type ReviewAction } from "@/lib/types";

const VERB: Record<ReviewAction["action"], string> = {
  approved: "approved",
  rejected: "rejected",
  needs_edit: "flagged for edit",
  needs_review: "reopened",
  imported: "imported",
  metadata_edited: "edited",
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function ActivityPanel({ actions }: { actions: ReviewAction[] }) {
  const [open, setOpen] = useState(false);
  if (actions.length === 0) return null;

  const shown = open ? actions.slice(0, 50) : actions.slice(0, 5);

  return (
    <div className="panel">
      <div className="topbar" style={{ paddingTop: 0 }}>
        <h3>Review activity</h3>
        <span className="spacer" />
        <button className="btn" onClick={() => setOpen((v) => !v)}>
          {open ? "Show less" : `Show all (${actions.length})`}
        </button>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {shown.map((a) => (
          <li key={a.id} className="issue" style={{ justifyContent: "space-between" }}>
            <span>
              <strong>{a.reviewer}</strong> {VERB[a.action]} <em>{a.candidateName}</em>
              {a.note ? ` — ${a.note}` : ""}
            </span>
            <span className="muted">{timeAgo(a.createdAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
