"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type StyleSample } from "@/lib/types";
import { MASTER_PROMPT, NEGATIVE_PROMPT, STYLE_NAME } from "@/lib/prompts";
import { type GenerationConfig } from "@/lib/generation-config";
import {
  GOLDEN_ITEMS,
  VARIATIONS_PER_ITEM,
  buildStyleSamples,
  decideSample,
  markClosest,
  scoreStyleLab,
  type GoldenItem,
} from "@/lib/style-lab";
import {
  loadStyleSamples,
  saveStyleSamples,
  replaceItemSamples,
  resetStyleLab,
  STYLE_LAB_CHANGE_EVENT,
} from "@/lib/style-lab-store";
import { AssetThumb } from "@/components/asset-thumb";
import { FactoryNav } from "@/components/factory-nav";

export function StyleLabClient() {
  const [samples, setSamples] = useState<StyleSample[]>([]);
  const [config, setConfig] = useState<GenerationConfig | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");

  useEffect(() => {
    setSamples(loadStyleSamples());
    const onChange = () => setSamples(loadStyleSamples());
    window.addEventListener(STYLE_LAB_CHANGE_EVENT, onChange);
    fetch("/api/generate/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.config && setConfig(d.config as GenerationConfig))
      .catch(() => setConfig(null));
    return () => window.removeEventListener(STYLE_LAB_CHANGE_EVENT, onChange);
  }, []);

  const score = useMemo(() => scoreStyleLab(samples), [samples]);
  const enabled = !!config?.enabled && !!config?.tokenConfigured;

  const samplesFor = useCallback(
    (key: string) => samples.filter((s) => s.itemKey === key).sort((a, b) => a.variation - b.variation),
    [samples],
  );

  function dryRun(item: GoldenItem) {
    const fresh = buildStyleSamples(item);
    setSamples((prev) => replaceItemSamples(prev, item.key, fresh));
  }

  async function realRun(item: GoldenItem) {
    setBusy(item.key);
    setError("");
    try {
      const res = await fetch("/api/generate/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: item.category, subject: item.subject, count: VARIATIONS_PER_ITEM, generatedToday: 0 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed.");
        return;
      }
      const fresh = buildStyleSamples(item, { imageUrls: data.imageUrls, count: data.imageUrls.length || VARIATIONS_PER_ITEM });
      setSamples((prev) => replaceItemSamples(prev, item.key, fresh));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy("");
    }
  }

  function decide(id: string, decision: StyleSample["decision"]) {
    setSamples((prev) => {
      const next = decideSample(prev, id, decision);
      saveStyleSamples(next);
      return next;
    });
  }

  function closest(id: string) {
    setSamples((prev) => {
      const next = markClosest(prev, id);
      saveStyleSamples(next);
      return next;
    });
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>🏭 Style Lab</h1>
        <span className="spacer" />
        <span className={`pill ${score.overall >= 100 ? "approved" : "queued"}`}>
          {score.itemsCalibrated}/{score.itemsTotal} calibrated
        </span>
      </div>
      <FactoryNav />
      {error && <p className="error">⚠ {error}</p>}

      <div className="panel">
        <div className="topbar" style={{ paddingTop: 0 }}>
          <h3>{STYLE_NAME}</h3>
          <span className="spacer" />
          <span style={{ fontSize: "1.6rem", fontWeight: 800 }}>{score.overall}</span>
          <span className="muted">/100 calibrated</span>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Generate 5 variations per golden item, approve/reject, and mark the one closest to the Nestudio
          identity. Choose ONE identity before scaling. {enabled ? "Real generation is ON." : "Generation is OFF — dry-run placeholders (zero cost)."}
        </p>
        <details>
          <summary className="muted">Master + negative prompt</summary>
          <div className="field" style={{ marginTop: 8 }}>
            <label>Master prompt</label>
            <textarea readOnly value={MASTER_PROMPT} style={{ minHeight: 70 }} />
          </div>
          <div className="field">
            <label>Negative prompt</label>
            <textarea readOnly value={NEGATIVE_PROMPT} style={{ minHeight: 60 }} />
          </div>
        </details>
        <button className="btn" onClick={() => { if (confirm("Clear all Style Lab samples?")) setSamples(resetStyleLab()); }}>
          ↺ Reset Style Lab
        </button>
      </div>

      {GOLDEN_ITEMS.map((item) => {
        const mine = samplesFor(item.key);
        const itemScore = score.items.find((i) => i.key === item.key)!;
        return (
          <div key={item.key} className="panel">
            <div className="topbar" style={{ paddingTop: 0 }}>
              <h3>{item.label}</h3>
              {itemScore.calibrated && <span className="pill approved">golden ✓</span>}
              <span className="spacer" />
              <span className="muted">{itemScore.generated} variations · {itemScore.approved} approved</span>
            </div>

            <div className="toolbar">
              <button className="btn btn-primary" disabled={busy === item.key} onClick={() => dryRun(item)}>
                Dry run 5 (no cost)
              </button>
              <button
                className="btn btn-green"
                disabled={!enabled || busy === item.key}
                title={enabled ? "" : "Set ASSET_GENERATION_ENABLED=true"}
                onClick={() => realRun(item)}
              >
                {busy === item.key ? "Generating…" : "Generate 5 (real)"}
              </button>
            </div>

            {mine.length === 0 ? (
              <p className="muted">No variations yet — generate to compare.</p>
            ) : (
              <div className="grid">
                {mine.map((s) => (
                  <div key={s.id} className={`card ${s.closest ? "selected" : ""}`} style={{ cursor: "default", opacity: s.decision === "rejected" ? 0.5 : 1 }}>
                    <div className="thumb" title={s.prompt}>
                      <AssetThumb src={s.imageUrl} alt={`${item.label} v${s.variation + 1}`} />
                    </div>
                    <div className="card-body">
                      <div className="card-meta">
                        <span className="muted">v{s.variation + 1}</span>
                        {s.decision === "approved" && <span className="pill approved">approved</span>}
                        {s.decision === "rejected" && <span className="pill rejected">rejected</span>}
                      </div>
                      <div className="chips" style={{ marginTop: 6 }}>
                        <button className={`chip ${s.decision === "approved" ? "active" : ""}`} onClick={() => decide(s.id, s.decision === "approved" ? "pending" : "approved")}>✓</button>
                        <button className={`chip ${s.decision === "rejected" ? "active" : ""}`} onClick={() => decide(s.id, s.decision === "rejected" ? "pending" : "rejected")}>✕</button>
                        <button className={`chip ${s.closest ? "active" : ""}`} onClick={() => closest(s.id)} title="Mark closest to Nestudio">★</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
