"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type StyleSample } from "@/lib/types";
import { type GenerationConfig } from "@/lib/generation-config";
import { NEGATIVE_PROMPT } from "@/lib/prompts";
import { STYLE_FAMILIES, styleMasterPreview, type StyleFamilyId } from "@/lib/styles";
import {
  GOLDEN_ITEMS,
  VARIATIONS_PER_ITEM,
  buildStyleSamples,
  realStyleSamples,
  parseStyleResult,
  decideSample,
  markClosest,
  scoreStyleLab,
  compareStyles,
  type GoldenItem,
} from "@/lib/style-lab";
import { loadStyleSamples, saveStyleSamples, resetStyleLab, STYLE_LAB_CHANGE_EVENT } from "@/lib/style-lab-store";
import { AssetThumb } from "@/components/asset-thumb";
import { FactoryNav } from "@/components/factory-nav";

export function StyleLabClient() {
  const [samples, setSamples] = useState<StyleSample[]>([]);
  const [config, setConfig] = useState<GenerationConfig | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");
  const [previewStyle, setPreviewStyle] = useState<StyleFamilyId>("royal_match");

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
  const comparison = useMemo(() => compareStyles(samples), [samples]);
  const enabled = !!config?.enabled && !!config?.tokenConfigured;

  const samplesFor = useCallback(
    (itemKey: string, styleId: string) =>
      samples.filter((s) => s.itemKey === itemKey && s.styleId === styleId).sort((a, b) => a.variation - b.variation),
    [samples],
  );

  // Functional updates so rapid clicks don't overwrite each other (no stale closure).
  function applyDecision(id: string, decision: StyleSample["decision"]) {
    setSamples((prev) => {
      const next = decideSample(prev, id, decision);
      saveStyleSamples(next);
      return next;
    });
  }
  function applyClosest(id: string) {
    setSamples((prev) => {
      const next = markClosest(prev, id);
      saveStyleSamples(next);
      return next;
    });
  }

  function replaceItemStyle(itemKey: string, styleId: StyleFamilyId, fresh: StyleSample[]) {
    setSamples((prev) => {
      const next = [...prev.filter((s) => !(s.itemKey === itemKey && s.styleId === styleId)), ...fresh];
      saveStyleSamples(next);
      return next;
    });
  }

  function dryRun(item: GoldenItem, styleId: StyleFamilyId) {
    replaceItemStyle(item.key, styleId, buildStyleSamples(item, styleId));
  }

  async function realRun(item: GoldenItem, styleId: StyleFamilyId) {
    setBusy(`${item.key}:${styleId}`);
    setError("");
    try {
      const res = await fetch("/api/generate/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: item.category, subject: item.subject, styleId, count: VARIATIONS_PER_ITEM, generatedToday: 0 }),
      });
      const data = await res.json().catch(() => ({}));
      const result = parseStyleResult(res.ok, data);
      if (!result.ok) {
        // Real generation failed — show a visible error, never placeholder images.
        setError(`${item.label} · ${styleId}: ${result.error}`);
        return;
      }
      // Real mode uses ONLY the provider's image URLs (no placeholder padding).
      replaceItemStyle(item.key, styleId, realStyleSamples(item, styleId, result.imageUrls));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>🏭 Style Lab</h1>
        <span className="spacer" />
        <Link href="/style-report" className="chip">Style Report →</Link>
      </div>
      <FactoryNav />
      {error && <p className="error">⚠ {error}</p>}

      <div className="panel">
        <div className="topbar" style={{ paddingTop: 0 }}>
          <h3>Multi-style calibration</h3>
          <span className="spacer" />
          <span className="muted">{score.itemsCalibrated}/{score.itemsTotal} items calibrated</span>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Compare the same asset across three identities, approve / reject, and mark the closest per style.
          {enabled ? " Real generation is ON." : " Generation is OFF — dry-run placeholders (zero cost)."}
        </p>
        <div className="chips" style={{ marginBottom: 8 }}>
          {comparison.families.map((f) => (
            <span key={f.styleId} className={`chip ${comparison.winningStyle === f.styleId ? "active" : ""}`}>
              {STYLE_FAMILIES.find((s) => s.id === f.styleId)!.shortLabel}: {f.approved}✓ · {f.closestSelections}★
              {comparison.winningStyle === f.styleId ? " · leading" : ""}
            </span>
          ))}
        </div>
        <details>
          <summary className="muted">Preview a style&apos;s master prompt</summary>
          <div className="chips" style={{ margin: "8px 0" }}>
            {STYLE_FAMILIES.map((s) => (
              <button key={s.id} className={`chip ${previewStyle === s.id ? "active" : ""}`} onClick={() => setPreviewStyle(s.id)}>{s.shortLabel}</button>
            ))}
          </div>
          <div className="field"><label>Master prompt</label><textarea readOnly value={styleMasterPreview(previewStyle)} style={{ minHeight: 70 }} /></div>
          <div className="field"><label>Negative prompt (shared)</label><textarea readOnly value={NEGATIVE_PROMPT} style={{ minHeight: 50 }} /></div>
        </details>
        <button className="btn" onClick={() => { if (confirm("Clear all Style Lab samples?")) setSamples(resetStyleLab()); }}>↺ Reset Style Lab</button>
      </div>

      {GOLDEN_ITEMS.map((item) => (
        <div key={item.key} className="panel">
          <h3 style={{ marginTop: 0 }}>{item.label}</h3>
          {STYLE_FAMILIES.map((fam) => {
            const mine = samplesFor(item.key, fam.id);
            const approved = mine.filter((s) => s.decision === "approved").length;
            return (
              <div key={fam.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 10 }}>
                <div className="topbar" style={{ paddingTop: 0 }}>
                  <strong>{fam.shortLabel}</strong>
                  <span className="spacer" />
                  <span className="muted">{mine.length} · {approved}✓</span>
                </div>
                <div className="toolbar">
                  <button className="btn btn-primary" disabled={busy === `${item.key}:${fam.id}`} onClick={() => dryRun(item, fam.id)}>Dry run 5</button>
                  <button className="btn btn-green" disabled={!enabled || busy === `${item.key}:${fam.id}`} title={enabled ? "" : "Set ASSET_GENERATION_ENABLED=true"} onClick={() => realRun(item, fam.id)}>
                    {busy === `${item.key}:${fam.id}` ? "…" : "Generate 5 (real)"}
                  </button>
                </div>
                {mine.length === 0 ? (
                  <p className="muted" style={{ fontSize: "0.82rem" }}>No variations yet.</p>
                ) : (
                  <div className="grid">
                    {mine.map((s) => (
                      <div key={s.id} className={`card ${s.closest ? "selected" : ""}`} style={{ cursor: "default", opacity: s.decision === "rejected" ? 0.5 : 1 }}>
                        <div className="thumb" title={s.prompt}><AssetThumb src={s.imageUrl} alt={`${item.label} ${fam.shortLabel} v${s.variation + 1}`} /></div>
                        <div className="card-body">
                          <div className="card-meta">
                            <span className="muted">v{s.variation + 1}</span>
                            {s.decision === "approved" && <span className="pill approved">✓</span>}
                            {s.closest && <span className="pill approved">★</span>}
                          </div>
                          <div className="chips" style={{ marginTop: 6 }}>
                            <button className={`chip ${s.decision === "approved" ? "active" : ""}`} onClick={() => applyDecision(s.id, s.decision === "approved" ? "pending" : "approved")}>✓</button>
                            <button className={`chip ${s.decision === "rejected" ? "active" : ""}`} onClick={() => applyDecision(s.id, s.decision === "rejected" ? "pending" : "rejected")}>✕</button>
                            <button className={`chip ${s.closest ? "active" : ""}`} onClick={() => applyClosest(s.id)} title="Closest to Nestudio">★</button>
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
      ))}
    </div>
  );
}
