"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type StyleSample, type SampleScores } from "@/lib/types";
import { GENERATION_DEFAULTS, modelForProvider, providerEnabled, providerTokenConfigured, type GenerationConfig } from "@/lib/generation-config";
import { NEGATIVE_PROMPT } from "@/lib/prompts";
import { NESTUDIO_V2, styleMasterPreview } from "@/lib/styles";
import { PROVIDERS, providerLabel, type ProviderId } from "@/lib/providers";
import {
  GOLDEN_ITEMS,
  VARIATIONS_PER_ITEM,
  buildStyleSamples,
  realStyleSamples,
  parseStyleResult,
  decideSample,
  markClosest,
  scoreSample,
  noteSample,
  type GoldenItem,
} from "@/lib/style-lab";
import {
  SCORE_DIMENSIONS,
  MAX_PER_DIMENSION,
  emptyScores,
  clampScores,
  sampleOverall,
  calibrationScore,
  styleLockStatus,
  CALIBRATION_PROVIDER,
  STYLE_LOCK_THRESHOLD,
} from "@/lib/calibration";
import { runStyleBatch, summarizeBatchErrors, type OneResult } from "@/lib/style-generate-runner";
import { loadStyleSamples, saveStyleSamples, resetStyleLab, STYLE_LAB_CHANGE_EVENT } from "@/lib/style-lab-store";
import { AssetThumb } from "@/components/asset-thumb";
import { FactoryNav } from "@/components/factory-nav";

const STYLE_ID = NESTUDIO_V2.id;

export function StyleLabClient() {
  const [samples, setSamples] = useState<StyleSample[]>([]);
  const [config, setConfig] = useState<GenerationConfig | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [provider, setProvider] = useState<ProviderId>(CALIBRATION_PROVIDER);

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

  const cal = useMemo(() => calibrationScore(samples), [samples]);
  const lock = useMemo(() => styleLockStatus(samples), [samples]);
  const readyFor = useCallback(
    (p: ProviderId) => !!config && providerEnabled(config, p) && providerTokenConfigured(config, p),
    [config],
  );
  const enabled = readyFor(provider);
  const shootoutReady = readyFor("replicate") && readyFor("openai");
  const modelFor = (p: ProviderId) => (config ? modelForProvider(config, p) : (p === "openai" ? GENERATION_DEFAULTS.openaiModel : GENERATION_DEFAULTS.model));

  const samplesFor = useCallback(
    (itemKey: string) => samples.filter((s) => s.itemKey === itemKey).sort((a, b) => a.variation - b.variation),
    [samples],
  );

  // Functional updates so rapid clicks don't overwrite each other (no stale closure).
  function applyDecision(id: string, decision: StyleSample["decision"]) {
    setSamples((prev) => { const next = decideSample(prev, id, decision); saveStyleSamples(next); return next; });
  }
  function applyClosest(id: string) {
    setSamples((prev) => { const next = markClosest(prev, id); saveStyleSamples(next); return next; });
  }
  function applyScore(id: string, scores: SampleScores) {
    setSamples((prev) => { const next = scoreSample(prev, id, clampScores(scores)); saveStyleSamples(next); return next; });
  }
  function applyNote(id: string, note: string) {
    setSamples((prev) => { const next = noteSample(prev, id, note); saveStyleSamples(next); return next; });
  }

  function replaceItem(itemKey: string, fresh: StyleSample[]) {
    setSamples((prev) => {
      const next = [...prev.filter((s) => s.itemKey !== itemKey), ...fresh];
      saveStyleSamples(next);
      return next;
    });
  }

  function dryRun(item: GoldenItem) {
    replaceItem(item.key, buildStyleSamples(item, STYLE_ID, { provider, model: modelFor(provider) }));
  }

  async function generateOneImage(item: GoldenItem, p: ProviderId): Promise<OneResult> {
    try {
      const res = await fetch("/api/generate/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: item.category, subject: item.subject, styleId: STYLE_ID, count: 1, generatedToday: 0, provider: p }),
      });
      const data = await res.json().catch(() => ({}));
      const result = parseStyleResult(res.ok, data);
      return result.ok ? { ok: true, url: result.imageUrls[0] } : { ok: false, error: result.error };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Generation failed." };
    }
  }

  // Real generation: SEQUENTIAL single-image calls with a delay (rate-limit safe).
  async function realRun(item: GoldenItem, total: number, p: ProviderId) {
    const key = item.key;
    setBusy(key);
    setError("");
    const delayMs = config?.requestDelayMs ?? GENERATION_DEFAULTS.requestDelayMs;
    try {
      const batch = await runStyleBatch(total, {
        generateOne: () => generateOneImage(item, p),
        delayMs,
        onProgress: (done, t) => setProgress((pr) => ({ ...pr, [key]: `Generating ${providerLabel(p)} ${done}/${t}…` })),
      });
      if (batch.urls.length > 0) {
        replaceItem(item.key, realStyleSamples(item, STYLE_ID, batch.urls, { provider: p, model: modelFor(p) }));
      }
      const summary = summarizeBatchErrors(total, batch);
      if (summary) setError(`${item.label} · ${providerLabel(p)}: ${summary}`);
    } finally {
      setBusy("");
      setProgress((pr) => { const next = { ...pr }; delete next[key]; return next; });
    }
  }

  // Model shootout: same asset, 1 image from EACH provider, side-by-side.
  async function shootout(item: GoldenItem) {
    const key = item.key;
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
        const r = await generateOneImage(item, p);
        if (r.ok) collected.push(...realStyleSamples(item, STYLE_ID, [r.url], { provider: p, model: modelFor(p) }));
        else errors.push(`${providerLabel(p)}: ${r.error}`);
        if (i < order.length - 1 && delayMs > 0) await new Promise((res) => setTimeout(res, delayMs));
      }
      if (collected.length > 0) replaceItem(item.key, collected);
      if (errors.length) setError(`${item.label} shootout: ${errors.join(" · ")}`);
    } finally {
      setBusy("");
      setProgress((pr) => { const next = { ...pr }; delete next[key]; return next; });
    }
  }

  // Calibration Session: generate ONE image per golden item from the selected
  // provider, sequentially (rate-limit safe). OpenAI-first calibration.
  async function generateCalibrationSet() {
    setBusy("__set__");
    setError("");
    const delayMs = config?.requestDelayMs ?? GENERATION_DEFAULTS.requestDelayMs;
    const errors: string[] = [];
    try {
      for (let i = 0; i < GOLDEN_ITEMS.length; i += 1) {
        const item = GOLDEN_ITEMS[i];
        setProgress((pr) => ({ ...pr, __set__: `Calibrating ${item.label} (${i + 1}/${GOLDEN_ITEMS.length}) via ${providerLabel(provider)}…` }));
        const r = await generateOneImage(item, provider);
        if (r.ok) replaceItem(item.key, realStyleSamples(item, STYLE_ID, [r.url], { provider, model: modelFor(provider) }));
        else errors.push(`${item.label}: ${r.error}`);
        if (i < GOLDEN_ITEMS.length - 1 && delayMs > 0) await new Promise((res) => setTimeout(res, delayMs));
      }
      if (errors.length) setError(`Calibration set: ${errors.join(" · ")}`);
    } finally {
      setBusy("");
      setProgress((pr) => { const next = { ...pr }; delete next.__set__; return next; });
    }
  }

  function dryRunSet() {
    setSamples(() => {
      const fresh = GOLDEN_ITEMS.flatMap((item) => buildStyleSamples(item, STYLE_ID, { count: 1, provider, model: modelFor(provider) }));
      saveStyleSamples(fresh);
      return fresh;
    });
  }

  const settingBusy = busy === "__set__";

  return (
    <div className="app">
      <div className="topbar">
        <h1>🏭 Style Lab — Calibration</h1>
        <span className="spacer" />
        <Link href="/style-report" className="chip">Calibration Report →</Link>
      </div>
      <FactoryNav />
      {error && <p className="error">⚠ {error}</p>}

      <div className="panel">
        <div className="topbar" style={{ paddingTop: 0 }}>
          <h3>Calibration Session — {NESTUDIO_V2.name}</h3>
          <span className="spacer" />
          <span className="muted">{cal.itemsApproved}/{cal.itemsTotal} approved · {cal.itemsScored}/{cal.itemsTotal} scored</span>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          OpenAI-first calibration of the single locked identity. Generate the golden set, approve/reject, add
          notes, and score each asset on five dimensions. {enabled ? `${providerLabel(provider)} generation is ON.` : " Generation is OFF — dry-run placeholders (zero cost)."}
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "stretch", margin: "8px 0" }}>
          <div style={{ textAlign: "center", minWidth: 120, flex: 1 }}>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: cal.overall >= STYLE_LOCK_THRESHOLD ? "var(--green)" : undefined }}>{cal.overall}</div>
            <div className="muted" style={{ fontSize: "0.72rem" }}>Calibration score / 100</div>
          </div>
          {SCORE_DIMENSIONS.map((d) => (
            <div key={d.key} style={{ textAlign: "center", minWidth: 90, flex: 1 }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{cal.dimensionAverages[d.key]}</div>
              <div className="muted" style={{ fontSize: "0.68rem" }}>{d.label} avg/10</div>
            </div>
          ))}
        </div>

        <div className={`panel ${lock.locked ? "" : ""}`} style={{ background: lock.locked ? "rgba(40,170,90,0.12)" : "var(--panel-2, rgba(0,0,0,0.03))", margin: "6px 0" }}>
          {lock.locked ? (
            <p style={{ margin: 0 }}>🔒 <strong>Style Locked.</strong> All {lock.itemsTotal} golden assets approved and calibration score {lock.score} ≥ {lock.threshold}. V4 mass generation may proceed.</p>
          ) : (
            <>
              <p style={{ margin: "0 0 6px" }}>🔓 <strong>Style not locked yet.</strong> V4 mass generation is blocked until:</p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {lock.reasons.map((r, i) => (<li key={i} className="muted" style={{ fontSize: "0.84rem" }}>{r}</li>))}
              </ul>
            </>
          )}
        </div>

        <div className="field" style={{ maxWidth: 360 }}>
          <label>Provider — model: {modelFor(provider)} {provider === CALIBRATION_PROVIDER ? "(calibration provider)" : "(comparison only)"}</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value as ProviderId)}>
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}{readyFor(p.id) ? "" : " — disabled"}</option>
            ))}
          </select>
        </div>

        <div className="toolbar">
          <button className="btn btn-primary" disabled={!!busy} onClick={dryRunSet}>Dry run set (10, no cost)</button>
          <button className="btn btn-green" disabled={!enabled || !!busy} title={enabled ? "Generate 1 image for each of the 10 golden items" : "Enable generation + configure the selected provider"} onClick={generateCalibrationSet}>
            Generate calibration set (10 × {providerLabel(provider)})
          </button>
          <button className="btn" onClick={() => { if (confirm("Clear all calibration samples?")) setSamples(resetStyleLab()); }}>↺ Reset</button>
        </div>
        {settingBusy && progress.__set__ && (
          <p className="muted" style={{ fontSize: "0.82rem" }}>⏳ {progress.__set__} (sequential, rate-limit safe)</p>
        )}

        <details>
          <summary className="muted">Preview the master prompt</summary>
          <div className="field"><label>Master prompt</label><textarea readOnly value={styleMasterPreview(STYLE_ID)} style={{ minHeight: 90 }} /></div>
          <div className="field"><label>Negative prompt</label><textarea readOnly value={NEGATIVE_PROMPT} style={{ minHeight: 60 }} /></div>
        </details>
      </div>

      {GOLDEN_ITEMS.map((item) => {
        const mine = samplesFor(item.key);
        const approved = mine.filter((s) => s.decision === "approved").length;
        const key = item.key;
        return (
          <div key={item.key} className="panel">
            <div className="topbar" style={{ paddingTop: 0 }}>
              <h3 style={{ margin: 0 }}>{item.label}</h3>
              <span className="spacer" />
              <span className="muted">{mine.length} · {approved}✓</span>
            </div>
            <div className="toolbar">
              <button className="btn btn-primary" disabled={!!busy} onClick={() => dryRun(item)}>Dry run 5</button>
              <button className="btn btn-green" disabled={!enabled || !!busy} title={enabled ? "" : "Enable generation + configure the selected provider"} onClick={() => realRun(item, 1, provider)}>
                Generate 1 ({providerLabel(provider)})
              </button>
              <button className="btn btn-green" disabled={!enabled || !!busy} title={enabled ? "" : "Enable generation + configure the selected provider"} onClick={() => realRun(item, VARIATIONS_PER_ITEM, provider)}>
                Generate 5 ({providerLabel(provider)})
              </button>
              <button className="btn btn-amber" disabled={!shootoutReady || !!busy} title={shootoutReady ? "1 image from each provider, side-by-side" : "Configure BOTH providers for a shootout"} onClick={() => shootout(item)}>
                Shootout (Replicate + OpenAI)
              </button>
            </div>
            {busy === key && progress[key] && (
              <p className="muted" style={{ fontSize: "0.82rem" }}>⏳ {progress[key]} (sequential, rate-limit safe)</p>
            )}
            {mine.length === 0 ? (
              <p className="muted" style={{ fontSize: "0.82rem" }}>No variations yet.</p>
            ) : (
              <div className="grid">
                {mine.map((s) => (
                  <SampleCard
                    key={s.id}
                    sample={s}
                    label={item.label}
                    onDecision={applyDecision}
                    onClosest={applyClosest}
                    onScore={applyScore}
                    onNote={applyNote}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SampleCard({
  sample: s, label, onDecision, onClosest, onScore, onNote,
}: {
  sample: StyleSample;
  label: string;
  onDecision: (id: string, decision: StyleSample["decision"]) => void;
  onClosest: (id: string) => void;
  onScore: (id: string, scores: SampleScores) => void;
  onNote: (id: string, note: string) => void;
}) {
  const [note, setNote] = useState(s.note ?? "");
  const scores = s.scores ?? emptyScores();
  const overall = s.scores ? sampleOverall(s.scores) : 0;
  const isCalibrationSample = s.provider === CALIBRATION_PROVIDER && s.styleId === NESTUDIO_V2.id;

  function setDim(key: keyof SampleScores, value: number) {
    onScore(s.id, { ...scores, [key]: value });
  }

  return (
    <div className={`card ${s.closest ? "selected" : ""}`} style={{ cursor: "default", opacity: s.decision === "rejected" ? 0.55 : 1 }}>
      <div className="thumb" title={s.prompt}><AssetThumb src={s.imageUrl} alt={`${label} ${providerLabel(s.provider)} v${s.variation + 1}`} /></div>
      <div className="card-body">
        <div className="card-meta">
          <span className="muted">v{s.variation + 1} · {providerLabel(s.provider)}</span>
          {s.decision === "approved" && <span className="pill approved">✓</span>}
          {s.closest && <span className="pill approved">★</span>}
          {s.scores && <span className="pill queued">{overall}/100</span>}
        </div>
        {s.model && <p className="muted" style={{ fontSize: "0.68rem", margin: "2px 0 0" }}>{s.model}{isCalibrationSample ? "" : " · comparison"}</p>}
        <div className="chips" style={{ marginTop: 6 }}>
          <button className={`chip ${s.decision === "approved" ? "active" : ""}`} onClick={() => onDecision(s.id, s.decision === "approved" ? "pending" : "approved")}>✓ Approve</button>
          <button className={`chip ${s.decision === "rejected" ? "active" : ""}`} onClick={() => onDecision(s.id, s.decision === "rejected" ? "pending" : "rejected")}>✕ Reject</button>
          <button className={`chip ${s.closest ? "active" : ""}`} onClick={() => onClosest(s.id)} title="Closest to Nestudio">★</button>
        </div>

        <details style={{ marginTop: 8 }}>
          <summary className="muted" style={{ fontSize: "0.78rem" }}>Score &amp; notes {s.scores ? `(${overall}/100)` : ""}</summary>
          <div style={{ marginTop: 6 }}>
            {SCORE_DIMENSIONS.map((d) => (
              <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
                <label style={{ fontSize: "0.72rem", flex: 1 }}>{d.label}</label>
                <input
                  type="range" min={0} max={MAX_PER_DIMENSION} step={1}
                  value={scores[d.key]}
                  onChange={(e) => setDim(d.key, Number(e.target.value))}
                  style={{ flex: 2 }}
                />
                <span className="muted" style={{ width: 20, textAlign: "right", fontSize: "0.72rem" }}>{scores[d.key]}</span>
              </div>
            ))}
            <div className="field" style={{ marginTop: 6 }}>
              <label style={{ fontSize: "0.72rem" }}>Notes</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => onNote(s.id, note)}
                placeholder="e.g. silhouette reads at 64px; slightly too glossy"
                style={{ minHeight: 44, fontSize: "0.78rem" }}
              />
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
