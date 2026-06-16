"use client";

import { type AssetCandidate } from "@/lib/types";
import { type QualityIssue } from "@/lib/quality";
import { CATEGORY_META } from "@/lib/types";
import { AssetThumb } from "@/components/asset-thumb";
import { IssueDots } from "@/components/quality-badges";

export function AssetCard({
  candidate,
  issues,
  selected,
  onSelect,
}: {
  candidate: AssetCandidate;
  issues: QualityIssue[];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className={`card ${selected ? "selected" : ""}`} onClick={onSelect}>
      <div className="thumb">
        <AssetThumb src={candidate.imageUrl} alt={candidate.name} />
      </div>
      <div className="card-body">
        <p className="card-title">{candidate.name}</p>
        <div className="card-meta">
          <span className={`pill ${candidate.status}`}>{candidate.status.replace("_", " ")}</span>
          <IssueDots issues={issues} />
        </div>
        <p className="muted" style={{ marginTop: 4 }}>
          {CATEGORY_META[candidate.category]?.label ?? candidate.category}
        </p>
      </div>
    </button>
  );
}
