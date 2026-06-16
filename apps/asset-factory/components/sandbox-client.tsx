"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type AssetCandidate, type AssetPack } from "@/lib/types";
import { getCandidateRepository } from "@/lib/repo";
import {
  generateSandboxRoom,
  SANDBOX_CREATOR_TYPES,
  SANDBOX_STYLES,
  type SandboxCreatorType,
  type SandboxResult,
  type SandboxStyle,
} from "@/lib/sandbox";
import { FactoryNav } from "@/components/factory-nav";

export function SandboxClient() {
  const repo = useMemo(() => getCandidateRepository(), []);
  const [candidates, setCandidates] = useState<AssetCandidate[]>([]);
  const [packs, setPacks] = useState<AssetPack[]>([]);
  const [packId, setPackId] = useState<string>("all");
  const [creatorType, setCreatorType] = useState<SandboxCreatorType>("cozy_creator");
  const [style, setStyle] = useState<SandboxStyle>("cozy");
  const [result, setResult] = useState<SandboxResult | null>(null);
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

  function generate() {
    const pack = packs.find((p) => p.id === packId);
    setResult(
      generateSandboxRoom({
        candidates,
        creatorType,
        style,
        packAssetIds: pack ? pack.assetIds : undefined,
      }),
    );
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>🏭 Room Designer Sandbox</h1>
      </div>
      <FactoryNav />
      {error && <p className="error">⚠ {error}</p>}

      <p className="muted">
        Runs the room-designer selection + placement logic on <strong>approved</strong> assets to prove
        they compose into a valid room. Selection only — no image generation.
      </p>

      <div className="panel">
        <div className="field">
          <label>Asset pool</label>
          <select value={packId} onChange={(e) => setPackId(e.target.value)}>
            <option value="all">All approved assets</option>
            {packs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="row">
          <div className="field">
            <label>Creator type</label>
            <select value={creatorType} onChange={(e) => setCreatorType(e.target.value as SandboxCreatorType)}>
              {SANDBOX_CREATOR_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Style</label>
            <select value={style} onChange={(e) => setStyle(e.target.value as SandboxStyle)}>
              {SANDBOX_STYLES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn btn-primary" onClick={generate}>Generate room</button>
      </div>

      {result && (
        <>
          <div className="panel">
            <h3>Composed: {result.intentLabel}</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Room type <strong>{result.roomKind}</strong> · background <strong>{result.background}</strong> ·
              pool {result.poolSize} approved · placed {result.placements.length} · unplaced {result.unplaced.length}
            </p>
            <div className="chips">
              {result.zoneUsage.map((z) => (
                <span key={z.zoneType} className={`chip ${z.used > 0 ? "active" : ""}`}>
                  {z.zoneType}: {z.used}/{z.max}
                </span>
              ))}
            </div>
          </div>

          <div className="panel">
            <h3>Placed assets ({result.placements.length})</h3>
            {result.placements.length === 0 ? (
              <p className="muted">Nothing placed — the pool has no compatible approved assets.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {result.placements.map((p) => (
                  <li key={p.assetId} className="issue" style={{ justifyContent: "space-between" }}>
                    <span><strong>{p.assetName}</strong> → {p.zoneLabel} <span className="muted">({p.action})</span></span>
                    <span className="muted">{p.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {result.unplaced.length > 0 && (
            <div className="panel">
              <h3>Could not place ({result.unplaced.length})</h3>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {result.unplaced.map((u) => (
                  <li key={u.assetId} className="issue warning">
                    <span className="dot warning" style={{ marginTop: 5 }} />
                    <span><strong>{u.assetName}</strong> — {u.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="panel">
            <h3>Why this layout</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {result.explanations.map((line, i) => (
                <li key={i} className="muted" style={{ fontSize: "0.85rem" }}>{line}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
