"use client";

import { useEffect, useMemo, useState } from "react";
import { type StyleSample } from "@/lib/types";
import { STYLE_FAMILIES } from "@/lib/styles";
import { GOLDEN_ITEMS, compareStyles, scoreStyleLab } from "@/lib/style-lab";
import { loadStyleSamples, STYLE_LAB_CHANGE_EVENT } from "@/lib/style-lab-store";
import { FactoryNav } from "@/components/factory-nav";

function familyName(id: string): string {
  return STYLE_FAMILIES.find((s) => s.id === id)?.name ?? id;
}

function Stat({ label, value, big }: { label: string; value: string | number; big?: boolean }) {
  return (
    <div style={{ textAlign: "center", minWidth: 90, flex: 1 }}>
      <div style={{ fontSize: big ? "1.6rem" : "1.3rem", fontWeight: 700 }}>{value}</div>
      <div className="muted" style={{ fontSize: "0.72rem" }}>{label}</div>
    </div>
  );
}

export function StyleReportClient() {
  const [samples, setSamples] = useState<StyleSample[]>([]);

  useEffect(() => {
    setSamples(loadStyleSamples());
    const onChange = () => setSamples(loadStyleSamples());
    window.addEventListener(STYLE_LAB_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(STYLE_LAB_CHANGE_EVENT, onChange);
  }, []);

  const comparison = useMemo(() => compareStyles(samples), [samples]);
  const itemScore = useMemo(() => scoreStyleLab(samples), [samples]);

  const winner = comparison.winningStyle;
  const hasData = samples.length > 0;

  return (
    <div className="app">
      <div className="topbar">
        <h1>🏭 Style Report</h1>
        <span className="spacer" />
        {winner ? (
          <span className="pill approved">Winning: {STYLE_FAMILIES.find((s) => s.id === winner)!.shortLabel}</span>
        ) : (
          <span className="pill queued">No winner yet</span>
        )}
      </div>
      <FactoryNav />

      {!hasData ? (
        <p className="muted">No Style Lab samples yet — generate and score variations in the Style Lab first.</p>
      ) : (
        <>
          <div className="panel">
            <div className="topbar" style={{ paddingTop: 0 }}>
              <h3>Winning style</h3>
              <span className="spacer" />
              <span style={{ fontSize: "1.2rem", fontWeight: 800 }}>{winner ? familyName(winner) : "—"}</span>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              Decided by most closest-to-Nestudio selections (tiebreak: approvals, then approval rate). Average
              approval-rate score across styles: <strong>{comparison.averageScore}</strong>/100. Items calibrated:
              {" "}{itemScore.itemsCalibrated}/{itemScore.itemsTotal}.
            </p>
          </div>

          {comparison.families.map((f) => (
            <div key={f.styleId} className={`panel ${winner === f.styleId ? "" : ""}`}>
              <div className="topbar" style={{ paddingTop: 0 }}>
                <h3>{familyName(f.styleId)}</h3>
                {winner === f.styleId && <span className="pill approved">winner</span>}
                <span className="spacer" />
                <span className="muted">{f.generated} generated</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Stat label="Approved" value={f.approved} big />
                <Stat label="Rejected" value={f.rejected} />
                <Stat label="Items approved" value={`${f.itemsApproved}/${GOLDEN_ITEMS.length}`} />
                <Stat label="Closest picks" value={`${f.closestSelections}/${GOLDEN_ITEMS.length}`} />
                <Stat label="Approval score" value={`${f.score}/100`} />
              </div>
            </div>
          ))}

          <div className="panel">
            <h3>Closest pick per item</h3>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {GOLDEN_ITEMS.map((item) => {
                const picks = samples.filter((s) => s.itemKey === item.key && s.closest);
                return (
                  <li key={item.key} className="issue" style={{ justifyContent: "space-between" }}>
                    <span><strong>{item.label}</strong></span>
                    <span className="muted">
                      {picks.length === 0 ? "—" : picks.map((p) => STYLE_FAMILIES.find((s) => s.id === p.styleId)?.shortLabel).join(", ")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
