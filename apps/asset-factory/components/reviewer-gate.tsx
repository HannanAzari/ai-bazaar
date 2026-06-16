"use client";

import { useEffect, useState } from "react";
import { getReviewer, setReviewer } from "@/lib/reviewer";

// Shown after password login, before the dashboard: capture the reviewer's name so
// their approve/reject actions are attributed in the shared activity log.
export function ReviewerGate({ children }: { children: (reviewer: string, onChange: () => void) => React.ReactNode }) {
  const [reviewer, setReviewerState] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setReviewerState(getReviewer());
  }, []);

  // null = not yet loaded (avoid hydration flash); "" = needs to enter a name.
  if (reviewer === null) return null;

  if (reviewer === "") {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1 style={{ marginTop: 0, fontSize: "1.1rem" }}>👋 Who&apos;s reviewing?</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            Your name is attached to approvals in the shared activity log.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = draft.trim();
              if (!name) return;
              setReviewer(name);
              setReviewerState(name);
            }}
          >
            <div className="field">
              <label htmlFor="reviewer">Reviewer name</label>
              <input id="reviewer" type="text" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: "100%", justifyContent: "center" }}>
              Start reviewing
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children(reviewer, () => setReviewerState(""))}</>;
}
