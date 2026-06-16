"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type AssetCandidate, type AssetPack } from "@/lib/types";
import { getCandidateRepository } from "@/lib/repo";
import { computeQualityScore, type QualityScore } from "@/lib/quality-score";
import { buildCatalogReport } from "@/lib/reports";
import { validateCatalog } from "@/lib/import-validation";
import { FactoryNav } from "@/components/factory-nav";

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? "var(--green)" : value >= 50 ? "var(--amber)" : "var(--red)";
  return (
    <div style={{ margin: "6px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div style={{ height: 8, background: "var(--line)", borderRadius: 999 }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ textAlign: "center", minWidth: 84, flex: 1 }}>
      <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{value}</div>
      <div className="muted" style={{ fontSize: "0.75rem" }}>{label}</div>
    </div>
  );
}

export function ReportsClient() {
  const repo = useMemo(() => getCandidateRepository(), []);
  const [candidates, setCandidates] = useState<AssetCandidate[]>([]);
  const [packs, setPacks] = useState<AssetPack[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([repo.list(), repo.listPacks()]);
      setCandidates(c);
      setPacks(p);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    }
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const score: QualityScore = useMemo(() => computeQualityScore(candidates), [candidates]);
  const report = useMemo(() => buildCatalogReport(candidates, packs), [candidates, packs]);
  const validation = useMemo(() => validateCatalog(candidates, { approvedOnly: true }), [candidates]);
  const packScores = useMemo(
    () =>
      packs.map((pack) => {
        const members = candidates.filter((c) => pack.assetIds.includes(c.id));
        return { pack, score: computeQualityScore(members) };
      }),
    [packs, candidates],
  );

  const failing = validation.results.filter((r) => !r.ok);
  const warnOnly = validation.results.filter((r) => r.ok && r.warnings.length > 0);

  return (
    <div className="app">
      <div className="topbar">
        <h1>🏭 Catalog Reports</h1>
      </div>
      <FactoryNav />
      {error && <p className="error">⚠ {error}</p>}

      <div className="panel">
        <div className="topbar" style={{ paddingTop: 0 }}>
          <h3>Catalog Quality Score</h3>
          <span className="spacer" />
          <span style={{ fontSize: "2rem", fontWeight: 800 }}>{score.overall}</span>
          <span className="muted">/100</span>
        </div>
        <ScoreBar label="Metadata completeness" value={score.metadataCompleteness} />
        <ScoreBar label="Tag quality" value={score.tagQuality} />
        <ScoreBar label="Zone coverage" value={score.zoneCoverage} />
        <ScoreBar label="Category balance" value={score.categoryBalance} />
        <ScoreBar label="Approved ratio" value={score.approvedRatio} />
      </div>

      <div className="panel">
        <h3>Catalog summary</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Stat label="Total" value={report.summary.total} />
          <Stat label="Approved" value={report.summary.approved} />
          <Stat label="Needs review" value={report.summary.needsReview} />
          <Stat label="Rejected" value={report.summary.rejected} />
          <Stat label="Needs edit" value={report.summary.needsEdit} />
          <Stat label="Packs" value={report.summary.packsCount} />
        </div>
      </div>

      <div className="panel">
        <h3>Coverage by group</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Stat label="Interior" value={report.coverage.interior} />
          <Stat label="Exterior" value={report.coverage.exterior} />
          <Stat label="Business" value={report.coverage.business} />
          <Stat label="Avatar" value={report.coverage.avatar} />
        </div>
      </div>

      <div className="panel">
        <h3>Room readiness (approved assets)</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Stat label="Room-ready" value={report.readiness.roomReady} />
          <Stat label="Missing metadata" value={report.readiness.missingMetadata} />
          <Stat label="Failing validation" value={report.readiness.failingValidation} />
        </div>
      </div>

      <div className="panel">
        <h3>Nestudio import validation</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          {validation.total} approved · {validation.passed} pass · {validation.withWarnings} with warnings ·{" "}
          {validation.failed} with errors
        </p>
        {failing.length > 0 && (
          <ul style={{ listStyle: "none", margin: "8px 0", padding: 0 }}>
            {failing.map((r) => (
              <li key={r.id} className="issue critical">
                <span className="dot critical" style={{ marginTop: 5 }} />
                <span><strong>{r.name}</strong> — {r.errors.map((e) => e.message).join(" ")}</span>
              </li>
            ))}
          </ul>
        )}
        {warnOnly.length > 0 && (
          <ul style={{ listStyle: "none", margin: "8px 0", padding: 0 }}>
            {warnOnly.slice(0, 12).map((r) => (
              <li key={r.id} className="issue warning">
                <span className="dot warning" style={{ marginTop: 5 }} />
                <span><strong>{r.name}</strong> — {r.warnings.map((w) => w.message).join(" ")}</span>
              </li>
            ))}
          </ul>
        )}
        {failing.length === 0 && (
          <p className="muted">No validation errors on approved assets. ✓</p>
        )}
      </div>

      <div className="panel">
        <h3>Pack quality scores</h3>
        {packScores.length === 0 ? (
          <p className="muted">No packs.</p>
        ) : (
          packScores.map(({ pack, score: s }) => (
            <div key={pack.id} className="issue" style={{ justifyContent: "space-between" }}>
              <span><strong>{pack.name}</strong> <span className="muted">({s.approvedCount} approved)</span></span>
              <span style={{ fontWeight: 700 }}>{s.overall}/100</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
