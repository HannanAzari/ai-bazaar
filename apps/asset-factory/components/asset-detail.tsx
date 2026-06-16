"use client";

import { useEffect, useState } from "react";
import {
  ALL_CATEGORIES,
  CATEGORY_META,
  type AssetCandidate,
  type AssetStatus,
  type FactoryCategory,
} from "@/lib/types";
import { runQualityChecks, canApprove } from "@/lib/quality";
import { AssetThumb } from "@/components/asset-thumb";
import { IssueList } from "@/components/quality-badges";

export function AssetDetail({
  candidate,
  all,
  onTransition,
  onSave,
  onClose,
}: {
  candidate: AssetCandidate;
  all: AssetCandidate[];
  onTransition: (to: AssetStatus) => void;
  onSave: (next: AssetCandidate) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(candidate.name);
  const [category, setCategory] = useState<FactoryCategory>(candidate.category);
  const [tags, setTags] = useState(candidate.tags.join(", "));
  const [notes, setNotes] = useState(candidate.qualityNotes);

  // Re-sync local fields when a different candidate is opened.
  useEffect(() => {
    setName(candidate.name);
    setCategory(candidate.category);
    setTags(candidate.tags.join(", "));
    setNotes(candidate.qualityNotes);
  }, [candidate.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const issues = runQualityChecks(candidate, all);
  const approvable = canApprove(candidate, all);

  function saveMetadata() {
    const meta = CATEGORY_META[category];
    onSave({
      ...candidate,
      name: name.trim() || candidate.name,
      category,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      qualityNotes: notes,
      // Keep the Nestudio-export defaults aligned with the (possibly changed) category.
      compatibleZones: meta.compatibleZones,
      placementType: meta.placement,
      defaultScale: meta.defaultScale,
      defaultActionType: meta.defaultActionType,
    });
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="detail" onClick={(e) => e.stopPropagation()}>
        <div className="topbar">
          <span className={`pill ${candidate.status}`}>{candidate.status.replace("_", " ")}</span>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Close ✕
          </button>
        </div>

        <div className="thumb preview-big">
          <AssetThumb src={candidate.imageUrl} alt={candidate.name} />
        </div>

        <h2>{candidate.name}</h2>
        <p className="muted">
          {candidate.width}×{candidate.height}px · {candidate.transparent ? "transparent" : "opaque"} ·
          pack: {candidate.pack}
        </p>

        <div className="actions-row">
          <button
            className="btn btn-green"
            disabled={!approvable}
            title={approvable ? "Approve (A)" : "Resolve critical issues first"}
            onClick={() => onTransition("approved")}
          >
            ✓ Approve
          </button>
          <button className="btn btn-red" onClick={() => onTransition("rejected")}>
            ✕ Reject
          </button>
          <button className="btn btn-amber" onClick={() => onTransition("needs_edit")}>
            ✎ Needs edit
          </button>
          <button className="btn" onClick={() => onTransition("needs_review")}>
            ↩ Back to review
          </button>
        </div>

        <h3 style={{ margin: "8px 0 4px" }}>Quality checks</h3>
        <IssueList issues={issues} />

        <div className="field">
          <label>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as FactoryCategory)}>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c].label} ({CATEGORY_META[c].group})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Tags (comma-separated)</label>
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        <div className="field">
          <label>Review notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 60 }} />
        </div>
        <button className="btn btn-primary" onClick={saveMetadata}>
          Save metadata
        </button>

        <h3 style={{ margin: "18px 0 4px" }}>Prompt</h3>
        <p className="muted" style={{ wordBreak: "break-word" }}>
          {candidate.prompt || "—"}
        </p>
      </div>
    </div>
  );
}
