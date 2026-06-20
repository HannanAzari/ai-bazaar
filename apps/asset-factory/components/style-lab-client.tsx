"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type StyleSample, type SampleScores, type AssetCandidate } from "@/lib/types";
import { getCandidateRepository } from "@/lib/repo";
import { exportJson, exportCandidatesJson, exportRoomEngineCatalog, roomEngineCatalog, approvedCatalog } from "@/lib/export";
import { GENERATION_DEFAULTS, modelForProvider, providerEnabled, providerTokenConfigured, type GenerationConfig } from "@/lib/generation-config";
import { NEGATIVE_PROMPT, NESTUDIO_DNA } from "@/lib/prompts";
import { NESTUDIO_V2, styleMasterPreview } from "@/lib/styles";
import {
  COLLECTION,
  DNA_PROVIDER,
  variantsForCategory,
  safeVariants,
  boldVariants,
  collectionCategory,
  dryRunDnaSamples,
  dnaSample,
  type Variant,
} from "@/lib/sofa-dna";
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
  appendSamples,
  replaceDryRunSamples,
  removeSample,
  clearDryRunSamples,
  isDryRunSample,
  approvedLibrary,
  exportApprovedSamples,
  approvedSamplesToCandidates,
  savedFromStyleLab,
  categoryCounts,
  isSampleSaved,
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

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJson(filename: string, data: unknown) {
  downloadText(filename, JSON.stringify(data, null, 2));
}

export function StyleLabClient() {
  const [samples, setSamples] = useState<StyleSample[]>([]);
  const [config, setConfig] = useState<GenerationConfig | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [provider, setProvider] = useState<ProviderId>(CALIBRATION_PROVIDER);
  const [collectionKey, setCollectionKey] = useState<string>("sofa");
  const [candidates, setCandidates] = useState<AssetCandidate[]>([]);
  const [notice, setNotice] = useState("");

  const repo = useMemo(() => getCandidateRepository(), []);
  const refreshCandidates = useCallback(async () => {
    try { setCandidates(await repo.list()); } catch { /* ignore */ }
  }, [repo]);

  useEffect(() => {
    setSamples(loadStyleSamples());
    void refreshCandidates();
    const onChange = () => setSamples(loadStyleSamples());
    window.addEventListener(STYLE_LAB_CHANGE_EVENT, onChange);
    fetch("/api/generate/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.config && setConfig(d.config as GenerationConfig))
      .catch(() => setConfig(null));
    return () => window.removeEventListener(STYLE_LAB_CHANGE_EVENT, onChange);
  }, [refreshCandidates]);

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

  // APPEND real renders — never drop existing samples (the V3.7 persistence fix).
  function appendReal(fresh: StyleSample[]) {
    if (fresh.length === 0) return;
    setSamples((prev) => { const next = appendSamples(prev, fresh); saveStyleSamples(next); return next; });
  }
  // Dry-run may only replace OTHER dry-run placeholders; real samples are preserved.
  function replaceDry(fresh: StyleSample[]) {
    setSamples((prev) => { const next = replaceDryRunSamples(prev, fresh); saveStyleSamples(next); return next; });
  }
  function applyRemove(id: string) {
    setSamples((prev) => { const next = removeSample(prev, id); saveStyleSamples(next); return next; });
  }
  function clearDryRuns() {
    setSamples((prev) => { const next = clearDryRunSamples(prev); saveStyleSamples(next); return next; });
  }

  const library = useMemo(() => approvedLibrary(samples), [samples]);
  const dryRunCount = useMemo(() => samples.filter(isDryRunSample).length, [samples]);
  // Candidates derived from the local approved/starred real samples — this is what a
  // Save SENDS to Supabase. Only OpenAI assets are persisted to production.
  const localApproved = useMemo(() => approvedSamplesToCandidates(samples, []), [samples]);
  const savableAssets = useMemo(() => localApproved.filter((c) => c.modelProvider === "openai"), [localApproved]);
  // SOURCE OF TRUTH for EXPORTS: the assets actually persisted to Supabase (source
  // "style_lab"), read back from the repo — NOT localStorage-only and NOT seed samples.
  const savedLibrary = useMemo(() => savedFromStyleLab(candidates), [candidates]);
  const savedCounts = useMemo(() => categoryCounts(savedLibrary), [savedLibrary]);
  const exportedApprovedCount = useMemo(() => approvedCatalog(savedLibrary).length, [savedLibrary]);
  const roomEngineCount = useMemo(() => roomEngineCatalog(savedLibrary).length, [savedLibrary]);

  async function saveApprovedToLibrary() {
    if (savableAssets.length === 0) return;
    setError("");
    try {
      const res = await fetch("/api/style-lab/save-approved-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: savableAssets }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error ?? "Save to Supabase failed."); return; }
      await refreshCandidates(); // re-read from Supabase so the library + exports update
      setNotice(`Saved ${data.saved} assets to Supabase Storage and library.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save to Supabase.");
    }
  }

  function dryRun(item: GoldenItem) {
    replaceDry(buildStyleSamples(item, STYLE_ID, { provider, model: modelFor(provider) }));
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
        appendReal(realStyleSamples(item, STYLE_ID, batch.urls, { provider: p, model: modelFor(p) }));
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
      if (collected.length > 0) appendReal(collected);
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
        if (r.ok) appendReal(realStyleSamples(item, STYLE_ID, [r.url], { provider, model: modelFor(provider) }));
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
    const fresh = GOLDEN_ITEMS.flatMap((item) => buildStyleSamples(item, STYLE_ID, { count: 1, provider, model: modelFor(provider) }));
    replaceDry(fresh);
  }

  // ── Manufacturer Collection (V3.7) — OpenAI only ───────────────────────────
  // Generate one image per personality for the SELECTED collection category (sofa /
  // chair / coffee table), sequentially. Each call sends a variant-specific subject;
  // the shared DNA + Signature Design Language + camera + isolation come from the
  // master prompt. Results are StyleSamples under the category's golden itemKey, so
  // they flow through the same calibration scoring + report and appear in that panel.
  async function generateVariantSubject(category: string, subject: string): Promise<OneResult> {
    try {
      const res = await fetch("/api/generate/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, subject, styleId: STYLE_ID, count: 1, generatedToday: 0, provider: DNA_PROVIDER }),
      });
      const data = await res.json().catch(() => ({}));
      const result = parseStyleResult(res.ok, data);
      return result.ok ? { ok: true, url: result.imageUrls[0] } : { ok: false, error: result.error };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Generation failed." };
    }
  }

  function dryRunCollection(goldenKey: string) {
    replaceDry(dryRunDnaSamples(goldenKey, { provider: DNA_PROVIDER, model: modelFor(DNA_PROVIDER) }));
  }

  async function generateCollection(goldenKey: string) {
    setBusy("__collection__");
    setError("");
    const delayMs = config?.requestDelayMs ?? GENERATION_DEFAULTS.requestDelayMs;
    const model = modelFor(DNA_PROVIDER);
    const variants = variantsForCategory(goldenKey);
    const label = collectionCategory(goldenKey).label;
    const errors: string[] = [];
    try {
      for (let i = 0; i < variants.length; i += 1) {
        const v = variants[i];
        setProgress((pr) => ({ ...pr, __collection__: `${label} DNA: ${v.personality} (${i + 1}/${variants.length})…` }));
        const r = await generateVariantSubject(v.category, v.subject);
        if (r.ok) appendReal([dnaSample(v, i, r.url, { provider: DNA_PROVIDER, model })]);
        else errors.push(`${v.name}: ${r.error}`);
        if (i < variants.length - 1 && delayMs > 0) await new Promise((res) => setTimeout(res, delayMs));
      }
      if (errors.length) setError(`${label} DNA: ${errors.join(" · ")}`);
    } finally {
      setBusy("");
      setProgress((pr) => { const next = { ...pr }; delete next.__collection__; return next; });
    }
  }

  const collectionReady = readyFor(DNA_PROVIDER);
  const collectionBusy = busy === "__collection__";
  const activeLabel = collectionCategory(collectionKey).label;

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
          <button className="btn" disabled={dryRunCount === 0} title="Remove zero-cost dry-run placeholders (real renders are kept)" onClick={clearDryRuns}>🧹 Clear dry-run ({dryRunCount})</button>
          <button className="btn" onClick={() => { if (confirm("Delete ALL samples, including real generated renders? This cannot be undone.")) setSamples(resetStyleLab()); }}>↺ Reset all</button>
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

      <div className="panel" style={{ borderLeft: "3px solid var(--accent, #c98a3a)" }}>
        <div className="topbar" style={{ paddingTop: 0 }}>
          <h3 style={{ margin: 0 }}>🧬 Manufacturer Collection (V3.7)</h3>
          <span className="spacer" />
          <span className="muted">OpenAI only · {COLLECTION.length} categories × 10</span>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          The manufacturer test: ten lifestyle personalities (5 safe + 5 bold) expressed across sofa, chair, and
          coffee table. They share one <strong>Signature Design Language</strong> (rounded corners, oak detailing,
          edge treatment, render finish) so everything reads as <em>one furniture collection</em> — recognizable even
          with colour and material stripped. Each category&apos;s 10 land in its golden panel below for a comparison grid.
        </p>
        <div className="field" style={{ maxWidth: 280 }}>
          <label>Collection category</label>
          <select value={collectionKey} onChange={(e) => setCollectionKey(e.target.value)}>
            {COLLECTION.map((c) => (<option key={c.goldenKey} value={c.goldenKey}>{c.label}</option>))}
          </select>
        </div>
        <p className="muted" style={{ margin: "0 0 4px", fontSize: "0.8rem" }}>✅ Safe ({safeVariants(collectionKey).length})</p>
        <div className="chips" style={{ marginBottom: 8 }}>
          {safeVariants(collectionKey).map((v: Variant) => (
            <span key={v.key} className="chip" title={`${v.silhouette} · ${v.material} · ${v.accent}`}>{v.personality}</span>
          ))}
        </div>
        <p className="muted" style={{ margin: "0 0 4px", fontSize: "0.8rem" }}>🔥 Bold ({boldVariants(collectionKey).length})</p>
        <div className="chips" style={{ marginBottom: 8 }}>
          {boldVariants(collectionKey).map((v: Variant) => (
            <span key={v.key} className="chip active" title={`${v.silhouette} · ${v.material} · ${v.accent}`}>{v.personality}</span>
          ))}
        </div>
        <details>
          <summary className="muted">Preview the shared Nestudio DNA + Signature Design Language</summary>
          <div className="field"><label>Nestudio DNA (identity + signature design language)</label><textarea readOnly value={NESTUDIO_DNA} style={{ minHeight: 130 }} /></div>
        </details>
        <div className="toolbar">
          <button className="btn btn-primary" disabled={!!busy} onClick={() => dryRunCollection(collectionKey)}>Dry run {activeLabel} 10 (no cost)</button>
          <button className="btn btn-green" disabled={!collectionReady || !!busy} title={collectionReady ? `Generate 10 ${activeLabel} personalities via OpenAI` : "Enable generation + configure OpenAI"} onClick={() => generateCollection(collectionKey)}>
            Generate 10 {activeLabel} (OpenAI)
          </button>
        </div>
        {collectionBusy && progress.__collection__ && (
          <p className="muted" style={{ fontSize: "0.82rem" }}>⏳ {progress.__collection__} (sequential, rate-limit safe)</p>
        )}
      </div>

      <div className="panel" style={{ borderLeft: "3px solid var(--green, #28aa5a)" }}>
        <div className="topbar" style={{ paddingTop: 0 }}>
          <h3 style={{ margin: 0 }}>⭐ Approved Library</h3>
          <span className="spacer" />
          <span className="muted">{savedLibrary.length} saved · {library.length} approvable</span>
        </div>
        {notice && <p className="muted" style={{ marginTop: 0 }}>✓ {notice}</p>}
        <p className="muted" style={{ marginTop: 0 }}>
          Approving a <strong>real OpenAI</strong> sample makes it savable; <strong>Save</strong> uploads each PNG to
          Supabase Storage (<em>asset-candidates/interior-v1</em>) and upserts an approved <em>style_lab</em> candidate
          row, so the main app / room engine can read it. Exports below use the <strong>Supabase-saved</strong> assets,
          not localStorage. Dry-run placeholders are never saved or exported.
        </p>
        {savedLibrary.length > 0 && (
          <p className="muted" style={{ fontSize: "0.8rem" }}>
            Saved by category: {Object.entries(savedCounts).map(([c, n]) => `${c} ${n}`).join(" · ")}
          </p>
        )}
        <p className="muted" style={{ fontSize: "0.74rem", fontFamily: "monospace", opacity: 0.85 }}>
          debug · saved style-lab (Supabase): {savedLibrary.length} · savable (localStorage): {savableAssets.length} ·
          exported approved: {exportedApprovedCount} · room-engine: {roomEngineCount} · repo mode: {repo.mode}
        </p>
        <div className="toolbar">
          <button className="btn btn-green" disabled={savableAssets.length === 0} title="Upload PNGs to Supabase Storage + upsert candidate rows" onClick={saveApprovedToLibrary}>
            💾 Save approved to Supabase ({savableAssets.length})
          </button>
          <button className="btn btn-primary" disabled={savedLibrary.length === 0} onClick={() => downloadText("approved-assets.json", exportJson(savedLibrary))}>
            ⬇ Export approved JSON ({exportedApprovedCount})
          </button>
          <button className="btn" disabled={savedLibrary.length === 0} onClick={() => downloadText("catalog-candidates.json", exportCandidatesJson(savedLibrary))}>
            ⬇ Export catalog JSON ({savedLibrary.length})
          </button>
          <button className="btn btn-primary" disabled={roomEngineCount === 0} title="Supabase-saved approved real OpenAI assets, in room-engine shape" onClick={() => downloadText("nestudio-interior-v1.catalog.json", exportRoomEngineCatalog(savedLibrary))}>
            🏠 Download room-engine catalog ({roomEngineCount})
          </button>
        </div>
        {library.length === 0 ? (
          <p className="muted" style={{ fontSize: "0.82rem" }}>No approved or starred real samples yet.</p>
        ) : (
          <div className="grid">
            {library.map((s) => {
              const saved = isSampleSaved(s, candidates);
              return (
                <div key={s.id} className="card" style={{ cursor: "default" }}>
                  <div className="thumb" title={s.prompt}><AssetThumb src={s.imageUrl} alt={s.subject} /></div>
                  <div className="card-body">
                    <div className="card-meta">
                      <span className="muted">{s.personality ? `${s.personality} · ` : ""}{s.category}</span>
                      {saved && <span className="pill approved" title="Saved to candidate library">✓ saved</span>}
                      {s.scores && <span className="pill queued">{sampleOverall(s.scores)}/100</span>}
                    </div>
                    <p className="muted" style={{ fontSize: "0.68rem", margin: "2px 0 0" }}>{providerLabel(s.provider)} · {s.model || "—"}</p>
                    <div className="chips" style={{ marginTop: 6 }}>
                      <button className="chip" onClick={() => downloadJson(`${s.id}.json`, exportApprovedSamples([s])[0])} title="Download this asset's JSON metadata">⬇ JSON</button>
                      <button className="chip" onClick={() => applyRemove(s.id)} title="Remove from samples (does not delete a saved candidate)">🗑 Remove</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
                    onRemove={applyRemove}
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
  sample: s, label, onDecision, onClosest, onScore, onNote, onRemove,
}: {
  sample: StyleSample;
  label: string;
  onDecision: (id: string, decision: StyleSample["decision"]) => void;
  onClosest: (id: string) => void;
  onScore: (id: string, scores: SampleScores) => void;
  onNote: (id: string, note: string) => void;
  onRemove: (id: string) => void;
}) {
  const [note, setNote] = useState(s.note ?? "");
  const scores = s.scores ?? emptyScores();
  const overall = s.scores ? sampleOverall(s.scores) : 0;
  const dry = isDryRunSample(s);
  // DNA samples encode the personality name as "Name — subject".
  const personality = s.subject && s.subject.includes("—") ? s.subject.split("—")[0].trim() : "";

  function setDim(key: keyof SampleScores, value: number) {
    onScore(s.id, { ...scores, [key]: value });
  }

  return (
    <div className={`card ${s.closest ? "selected" : ""}`} style={{ cursor: "default", opacity: s.decision === "rejected" ? 0.55 : 1 }}>
      <div className="thumb" title={s.prompt}><AssetThumb src={s.imageUrl} alt={`${label} ${providerLabel(s.provider)} v${s.variation + 1}`} /></div>
      <div className="card-body">
        <div className="card-meta">
          <span className="muted">{personality || `v${s.variation + 1}`} · {providerLabel(s.provider)}</span>
          <span className={`pill ${dry ? "queued" : "approved"}`} title={dry ? "Zero-cost dry-run placeholder (not exported)" : "Real provider render"}>{dry ? "dry-run" : "real"}</span>
          {s.decision === "approved" && <span className="pill approved">✓</span>}
          {s.closest && <span className="pill approved">★</span>}
          {s.scores && <span className="pill queued">{overall}/100</span>}
        </div>
        {s.model && <p className="muted" style={{ fontSize: "0.68rem", margin: "2px 0 0" }}>{s.model}</p>}
        <div className="chips" style={{ marginTop: 6 }}>
          <button className={`chip ${s.decision === "approved" ? "active" : ""}`} onClick={() => onDecision(s.id, s.decision === "approved" ? "pending" : "approved")}>✓ Approve</button>
          <button className={`chip ${s.decision === "rejected" ? "active" : ""}`} onClick={() => onDecision(s.id, s.decision === "rejected" ? "pending" : "rejected")}>✕ Reject</button>
          <button className={`chip ${s.closest ? "active" : ""}`} onClick={() => onClosest(s.id)} title="Closest to Nestudio">★</button>
          <button className="chip" onClick={() => { if (confirm("Remove this sample?")) onRemove(s.id); }} title="Delete this sample">🗑</button>
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
