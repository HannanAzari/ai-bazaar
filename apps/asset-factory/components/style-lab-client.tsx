"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type StyleSample } from "@/lib/types";
import { GENERATION_DEFAULTS, modelForProvider, providerEnabled, providerTokenConfigured, type GenerationConfig } from "@/lib/generation-config";
import { NEGATIVE_PROMPT } from "@/lib/prompts";
import { STYLE_FAMILIES, styleMasterPreview, type StyleFamilyId } from "@/lib/styles";
import { PROVIDERS, providerLabel, type ProviderId } from "@/lib/providers";
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
import { runStyleBatch, summarizeBatchErrors, type OneResult } from "@/lib/style-generate-runner";
import { loadStyleSamples, saveStyleSamples, resetStyleLab, STYLE_LAB_CHANGE_EVENT } from "@/lib/style-lab-store";
import { AssetThumb } from "@/components/asset-thumb";
import { FactoryNav } from "@/components/factory-nav";

export function StyleLabClient() {
  const [samples, setSamples] = useState<StyleSample[]>([]);
  const [config, setConfig] = useState<GenerationConfig | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [previewStyle, setPreviewStyle] = useState<StyleFamilyId>("royal_match");
  const [provider, setProvider] = useState<ProviderId>("replicate");

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
  const readyFor = useCallback(
    (p: ProviderId) => !!config && providerEnabled(config, p) && providerTokenConfigured(config, p),
    [config],
  );
  const enabled = readyFor(provider);
  const shootoutReady = readyFor("replicate") && readyFor("openai");
  const modelFor = (p: ProviderId) => (config ? modelForProvider(config, p) : (p === "openai" ? GENERATION_DEFAULTS.openaiModel : GENERATION_DEFAULTS.model));

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
    replaceItemStyle(item.key, styleId, buildStyleSamples(item, styleId, { provider, model: modelFor(provider) }));
  }

  // One single-image provider call (count: 1) → a normalized result.
  async function generateOneImage(item: GoldenItem, styleId: StyleFamilyId, p: ProviderId): Promise<OneResult> {
    try {
      const res = await fetch("/api/generate/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: item.category, subject: item.subject, styleId, count: 1, generatedToday: 0, provider: p }),
      });
      const data = await res.json().catch(() => ({}));
      const result = parseStyleResult(res.ok, data);
      return result.ok ? { ok: true, url: result.imageUrls[0] } : { ok: false, error: result.error };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Generation failed." };
    }
  }

  // Real generation: SEQUENTIAL single-image calls with a delay between them
  // (rate-limit safe). Preserves partial successes; never shows placeholders.
  async function realRun(item: GoldenItem, styleId: StyleFamilyId, total: number, p: ProviderId) {
    const key = `${item.key}:${styleId}`;
    setBusy(key);
    setError("");
    const delayMs = config?.requestDelayMs ?? GENERATION_DEFAULTS.requestDelayMs;
    try {
      const batch = await runStyleBatch(total, {
        generateOne: () => generateOneImage(item, styleId, p),
        delayMs,
        onProgress: (done, t) => setProgress((pr) => ({ ...pr, [key]: `Generating ${providerLabel(p)} ${done}/${t}…` })),
      });
      if (batch.urls.length > 0) {
        replaceItemStyle(item.key, styleId, realStyleSamples(item, styleId, batch.urls, { provider: p, model: modelFor(p) }));
      }
      const summary = summarizeBatchErrors(total, batch);
      if (summary) setError(`${item.label} · ${STYLE_FAMILIES.find((s) => s.id === styleId)!.shortLabel} · ${providerLabel(p)}: ${summary}`);
    } finally {
      setBusy("");
      setProgress((pr) => { const next = { ...pr }; delete next[key]; return next; });
    }
  }

  // Model shootout: same asset + style, 1 image from EACH provider, side-by-side.
  // Sequential (rate-limit safe); preserves partial success; tags each by provider.
  async function shootout(item: GoldenItem, styleId: StyleFamilyId) {
    const key = `${item.key}:${styleId}`;
    setBusy(key);
    setError("");
    const delayMs = config?.requestDelayMs ?? GENERATION_DEFAULTS.requestDelayMs;
    const order: ProviderId[] = ["replicate", "openai"];
    const collected: StyleSample[] = [];
    const errors: string[] = [];
    try {
      for (let i = 0; i < order.length; i += 1) {
        const p = order[i];
        setProgress((pr) => ({ ...pr, [key]: `Shootout ${providerLabel(p)} ${i + 1}/${order.length}…` }));
        const r = await generateOneImage(item, styleId, p);
        if (r.ok) collected.push(...realStyleSamples(item, styleId, [r.url], { provider: p, model: modelFor(p) }));
        else errors.push(`${providerLabel(p)}: ${r.error}`);
        if (i < order.length - 1 && delayMs > 0) await new Promise((res) => setTimeout(res, delayMs));
      }
      if (collected.length > 0) replaceItemStyle(item.key, styleId, collected);
      if (errors.length) setError(`${item.label} · ${STYLE_FAMILIES.find((s) => s.id === styleId)!.shortLabel} shootout: ${errors.join(" · ")}`);
    } finally {
      setBusy("");
      setProgress((pr) => { const next = { ...pr }; delete next[key]; return next; });
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
          Compare the same asset across three identities + providers, approve / reject, and mark the closest per style.
          {enabled ? ` ${providerLabel(provider)} generation is ON.` : " Generation is OFF — dry-run placeholders (zero cost)."}
        </p>
        <div className="field" style={{ maxWidth: 360 }}>
          <label>Provider (for Generate buttons) — model: {modelFor(provider)}</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value as ProviderId)}>
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}{readyFor(p.id) ? "" : " — disabled"}</option>
            ))}
          </select>
        </div>
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
                  <button className="btn btn-green" disabled={!enabled || !!busy} title={enabled ? "" : "Enable generation + configure the selected provider"} onClick={() => realRun(item, fam.id, 1, provider)}>
                    Generate 1 ({providerLabel(provider)})
                  </button>
                  <button className="btn btn-green" disabled={!enabled || !!busy} title={enabled ? "" : "Enable generation + configure the selected provider"} onClick={() => realRun(item, fam.id, VARIATIONS_PER_ITEM, provider)}>
                    Generate 5 ({providerLabel(provider)})
                  </button>
                  <button className="btn btn-amber" disabled={!shootoutReady || !!busy} title={shootoutReady ? "1 image from each provider, side-by-side" : "Configure BOTH providers for a shootout"} onClick={() => shootout(item, fam.id)}>
                    Shootout (Replicate + OpenAI)
                  </button>
                </div>
                {busy === `${item.key}:${fam.id}` && progress[`${item.key}:${fam.id}`] && (
                  <p className="muted" style={{ fontSize: "0.82rem" }}>⏳ {progress[`${item.key}:${fam.id}`]} (sequential, rate-limit safe)</p>
                )}
                {mine.length === 0 ? (
                  <p className="muted" style={{ fontSize: "0.82rem" }}>No variations yet.</p>
                ) : (
                  <div className="grid">
                    {mine.map((s) => (
                      <div key={s.id} className={`card ${s.closest ? "selected" : ""}`} style={{ cursor: "default", opacity: s.decision === "rejected" ? 0.5 : 1 }}>
                        <div className="thumb" title={s.prompt}><AssetThumb src={s.imageUrl} alt={`${item.label} ${fam.shortLabel} v${s.variation + 1}`} /></div>
                        <div className="card-body">
                          <div className="card-meta">
                            <span className="muted">v{s.variation + 1} · {providerLabel(s.provider)}</span>
                            {s.decision === "approved" && <span className="pill approved">✓</span>}
                            {s.closest && <span className="pill approved">★</span>}
                          </div>
                          {s.model && <p className="muted" style={{ fontSize: "0.68rem", margin: "2px 0 0" }}>{s.model}</p>}
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
