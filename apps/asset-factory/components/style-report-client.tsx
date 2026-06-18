"use client";

import { useEffect, useMemo, useState } from "react";
import { type StyleSample } from "@/lib/types";
import { calibrationReport, calibrationScore, SCORE_DIMENSIONS, STYLE_LOCK_THRESHOLD } from "@/lib/calibration";
import { loadStyleSamples, STYLE_LAB_CHANGE_EVENT } from "@/lib/style-lab-store";
import { providerLabel } from "@/lib/providers";
import { FactoryNav } from "@/components/factory-nav";

function Stat({ label, value, big, accent }: { label: string; value: string | number; big?: boolean; accent?: boolean }) {
  return (
    <div style={{ textAlign: "center", minWidth: 90, flex: 1 }}>
      <div style={{ fontSize: big ? "1.8rem" : "1.3rem", fontWeight: 700, color: accent ? "var(--green)" : undefined }}>{value}</div>
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

  const report = useMemo(() => calibrationReport(samples), [samples]);
  const score = useMemo(() => calibrationScore(samples), [samples]);
  const { lock } = report;
  const hasData = samples.length > 0;

  return (
    <div className="app">
      <div className="topbar">
        <h1>🏭 Calibration Report</h1>
        <span className="spacer" />
        {lock.locked ? (
          <span className="pill approved">🔒 Style Locked</span>
        ) : (
          <span className="pill queued">🔓 Not locked ({lock.score}/{lock.threshold})</span>
        )}
      </div>
      <FactoryNav />

      {!hasData ? (
        <p className="muted">No calibration samples yet — generate and score the golden set in the Style Lab first.</p>
      ) : (
        <>
          <div className="panel">
            <div className="topbar" style={{ paddingTop: 0 }}>
              <h3>Calibration summary</h3>
              <span className="spacer" />
              <span className="muted">OpenAI · nestudio_v2 only</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Stat label="Calibration score / 100" value={score.overall} big accent={score.overall >= STYLE_LOCK_THRESHOLD} />
              <Stat label="Avg approved score" value={`${report.averageScore}/100`} />
              <Stat label="Items approved" value={`${score.itemsApproved}/${score.itemsTotal}`} />
              <Stat label="Items scored" value={`${score.itemsScored}/${score.itemsTotal}`} />
              <Stat label="Lock threshold" value={lock.threshold} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
              {SCORE_DIMENSIONS.map((d) => (
                <Stat key={d.key} label={`${d.label} avg/10`} value={score.dimensionAverages[d.key]} />
              ))}
            </div>
          </div>

          <div className="panel">
            <h3>Style lock</h3>
            {lock.locked ? (
              <p style={{ margin: 0 }}>🔒 <strong>Locked.</strong> All {lock.itemsTotal} golden assets approved and the calibration score ({lock.score}) meets the {lock.threshold} threshold. V4 mass generation may proceed.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {lock.reasons.map((r, i) => (<li key={i} className="muted" style={{ fontSize: "0.86rem" }}>{r}</li>))}
              </ul>
            )}
          </div>

          <div className="panel">
            <h3>Approved assets ({report.approved.length})</h3>
            {report.approved.length === 0 ? (
              <p className="muted">None approved yet.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {report.approved.map((r) => (
                  <li key={r.itemKey} className="issue" style={{ justifyContent: "space-between" }}>
                    <span><strong>{r.label}</strong> <span className="muted">· {providerLabel(r.provider)} {r.model}</span>{r.note ? <span className="muted"> · “{r.note}”</span> : ""}</span>
                    <span className="muted">{r.overall}/100</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel">
            <h3>Rejected assets ({report.rejected.length})</h3>
            {report.rejected.length === 0 ? (
              <p className="muted">None rejected.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {report.rejected.map((r, i) => (
                  <li key={`${r.itemKey}-${i}`} className="issue" style={{ justifyContent: "space-between" }}>
                    <span><strong>{r.label}</strong> <span className="muted">· {providerLabel(r.provider)} {r.model}</span>{r.note ? <span className="muted"> · “{r.note}”</span> : ""}</span>
                    <span className="muted">{r.overall}/100</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel">
            <h3>Visual consistency notes</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {report.consistencyNotes.map((n, i) => (<li key={i} className="muted" style={{ fontSize: "0.86rem" }}>{n}</li>))}
            </ul>
          </div>

          <div className="panel">
            <h3>Remaining issues</h3>
            {report.remainingIssues.length === 0 ? (
              <p className="muted">None — the style is fully calibrated.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {report.remainingIssues.map((n, i) => (<li key={i} className="muted" style={{ fontSize: "0.86rem" }}>{n}</li>))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
