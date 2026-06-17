"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ALL_CATEGORIES,
  CATEGORY_META,
  type AssetCandidate,
  type AssetPack,
  type FactoryCategory,
  type GenerationJob,
} from "@/lib/types";
import { getCandidateRepository } from "@/lib/repo";
import { NEGATIVE_PROMPT } from "@/lib/prompts";
import { STYLE_FAMILIES, DEFAULT_STYLE_FAMILY, buildStyledPrompt, styleLabel, type StyleFamilyId } from "@/lib/styles";
import {
  GENERATION_DEFAULTS,
  estimateCost,
  type GenerationConfig,
} from "@/lib/generation-config";
import { createGenerationJob, dryRunCandidates, usageStats } from "@/lib/generation-job";
import { validateGenerated, summarizeValidations, type CandidateValidation } from "@/lib/generation-validate";
import { FactoryNav } from "@/components/factory-nav";

type RunOutput = { job: GenerationJob; candidates: AssetCandidate[]; validations: CandidateValidation[] };

export function GenerateClient() {
  const repo = useMemo(() => getCandidateRepository(), []);
  const [config, setConfig] = useState<GenerationConfig | null>(null);
  const [candidates, setCandidates] = useState<AssetCandidate[]>([]);
  const [packs, setPacks] = useState<AssetPack[]>([]);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);

  const [category, setCategory] = useState<FactoryCategory>("chair");
  const [styleId, setStyleId] = useState<StyleFamilyId>(DEFAULT_STYLE_FAMILY);
  const [packId, setPackId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [count, setCount] = useState(2);
  const [reviewer, setReviewer] = useState("");

  const [output, setOutput] = useState<RunOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [c, p, j] = await Promise.all([repo.list(), repo.listPacks(), repo.listJobs()]);
      setCandidates(c);
      setPacks(p);
      setJobs(j);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    }
  }, [repo]);

  useEffect(() => {
    void refresh();
    // Fetch the SAFE server config (enabled / limits / cost / tokenConfigured).
    fetch("/api/generate/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.config && setConfig(d.config as GenerationConfig))
      .catch(() => setConfig(null));
  }, [refresh]);

  const effConfig: GenerationConfig = config ?? {
    provider: "replicate",
    model: GENERATION_DEFAULTS.model,
    maxBatchSize: GENERATION_DEFAULTS.maxBatchSize,
    maxDailyGenerations: GENERATION_DEFAULTS.maxDailyGenerations,
    estimatedCostPerImage: GENERATION_DEFAULTS.estimatedCostPerImage,
    enabled: false,
    tokenConfigured: false,
    timeoutMs: GENERATION_DEFAULTS.timeoutMs,
    retryLimit: GENERATION_DEFAULTS.retryLimit,
  };

  const safeCount = Math.max(1, Math.min(Math.floor(count) || 1, effConfig.maxBatchSize));
  const prompt = buildStyledPrompt(category, styleId, { subject });
  const usage = usageStats(jobs);
  const estCost = estimateCost(safeCount, effConfig);

  function persistOutput(out: RunOutput, persisted: boolean) {
    setOutput(out);
    setJobs((prev) => [out.job, ...prev.filter((j) => j.id !== out.job.id)]);
    if (!persisted && out.candidates.length > 0) {
      void repo.addCandidates(out.candidates).then(() => refresh());
    } else {
      void refresh();
    }
    void repo.saveJob(out.job);
  }

  async function runDryRun() {
    setError("");
    setNotice("");
    let job = createGenerationJob({
      category, pack: packId || "generated", count: safeCount, subject,
      requestedBy: reviewer, dryRun: true, config: effConfig, styleId,
    });
    const built = dryRunCandidates(job, candidates);
    job = { ...job, status: "completed", completedAt: new Date().toISOString(), actualCost: 0, generatedCandidateIds: built.map((c) => c.id) };
    const validations = built.map((c) => validateGenerated(c, [...candidates, ...built], packs.find((p) => p.id === packId)));
    setOutput({ job, candidates: built, validations });
    void repo.saveJob(job);
    setNotice(`Dry run built ${built.length} placeholder candidate(s) — review them, then send to the queue. No cost.`);
  }

  async function sendToReview() {
    if (!output) return;
    await repo.addCandidates(output.candidates);
    await repo.saveJob(output.job);
    await refresh();
    setNotice(`Sent ${output.candidates.length} candidate(s) to the review queue (needs_review).`);
    setOutput(null);
  }

  async function runReal() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category, pack: packId || "generated", count: safeCount, subject,
          requestedBy: reviewer, generatedToday: usage.generatedToday, styleId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed.");
        return;
      }
      persistOutput({ job: data.job, candidates: data.candidates, validations: data.validations }, data.persisted);
      const sum = summarizeValidations(data.validations ?? []);
      setNotice(`Generated ${data.candidates.length} candidate(s) → needs_review. Validation: ${sum.passed} clean, ${sum.withWarnings} with warnings, ${sum.failed} failing.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelJob(job: GenerationJob) {
    const next = { ...job, status: "cancelled" as const, completedAt: new Date().toISOString() };
    setJobs((prev) => prev.map((j) => (j.id === job.id ? next : j)));
    await repo.saveJob(next);
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>🏭 Generate</h1>
        <span className="spacer" />
        <span className={`pill ${effConfig.enabled ? "approved" : "rejected"}`}>
          {effConfig.enabled ? "Generation ON" : "Generation OFF"}
        </span>
      </div>
      <FactoryNav />

      {error && <p className="error">⚠ {error}</p>}
      {notice && <p className="muted">✓ {notice}</p>}

      <div className="panel">
        <p className="muted" style={{ marginTop: 0 }}>
          Provider <strong>{effConfig.provider}</strong> · model <strong>{effConfig.model}</strong> ·
          max batch {effConfig.maxBatchSize} · daily limit {effConfig.maxDailyGenerations} ·
          token {effConfig.tokenConfigured ? "configured" : "missing"}.
        </p>
        {!effConfig.enabled && (
          <p className="muted">
            Real generation is <strong>disabled</strong> (ASSET_GENERATION_ENABLED=false). Dry run works with zero cost.
          </p>
        )}

        <div className="row">
          <div className="field">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as FactoryCategory)}>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_META[c].label} ({CATEGORY_META[c].group})</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Pack (optional)</label>
            <select value={packId} onChange={(e) => setPackId(e.target.value)}>
              <option value="">— none —</option>
              {packs.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Style</label>
          <select value={styleId} onChange={(e) => setStyleId(e.target.value as StyleFamilyId)}>
            {STYLE_FAMILIES.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {s.description}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Asset idea</label>
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. a mid-century walnut armchair" />
        </div>
        <div className="row">
          <div className="field">
            <label>Count (max {effConfig.maxBatchSize})</label>
            <input type="number" min={1} max={effConfig.maxBatchSize} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Requested by</label>
            <input type="text" value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="your name" />
          </div>
        </div>

        <div className="field">
          <label>Master prompt (preview)</label>
          <textarea readOnly value={prompt} style={{ minHeight: 70 }} />
        </div>
        <div className="field">
          <label>Negative prompt</label>
          <textarea readOnly value={NEGATIVE_PROMPT} style={{ minHeight: 50 }} />
        </div>

        <p className="muted">Estimated cost for {safeCount} image(s): <strong>${estCost.toFixed(3)}</strong></p>

        <div className="toolbar">
          <button className="btn btn-primary" onClick={runDryRun}>Dry run (no cost)</button>
          <button
            className="btn btn-green"
            disabled={!effConfig.enabled || !effConfig.tokenConfigured || busy}
            title={effConfig.enabled ? "" : "Set ASSET_GENERATION_ENABLED=true"}
            onClick={runReal}
          >
            {busy ? "Generating…" : "Generate (real)"}
          </button>
        </div>
      </div>

      {output && (
        <div className="panel">
          <div className="topbar" style={{ paddingTop: 0 }}>
            <h3>{output.job.dryRun ? "Dry-run result" : "Generated"}</h3>
            <span className="spacer" />
            <span className={`pill ${output.job.status === "completed" ? "approved" : "rejected"}`}>{output.job.status}</span>
          </div>
          {output.job.dryRun && output.candidates.length > 0 && (
            <button className="btn btn-primary" style={{ marginBottom: 8 }} onClick={sendToReview}>
              Send {output.candidates.length} to review queue
            </button>
          )}
          {output.job.error && <p className="error">{output.job.error}</p>}
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {output.validations.map((v) => (
              <li key={v.id} className={`issue ${v.ok ? "" : "critical"}`} style={{ justifyContent: "space-between" }}>
                <span>
                  <strong>{v.name}</strong>{" "}
                  {v.nestudio.ok ? <span className="muted">placeable ✓</span> : <span style={{ color: "var(--red)" }}>{v.nestudio.errors.map((e) => e.message).join(" ")}</span>}
                </span>
                <span className="muted">
                  {[...v.quality.map((q) => q.code), ...v.nestudio.warnings.map((w) => w.code), ...v.packNotes].slice(0, 3).join(", ") || "clean"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel">
        <h3>Cost tracking</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Stat label="Generated today" value={usage.generatedToday} />
          <Stat label="Est. spend today" value={`$${usage.estSpendToday.toFixed(3)}`} />
          <Stat label="Generated this month" value={usage.generatedThisMonth} />
          <Stat label="Daily limit" value={effConfig.maxDailyGenerations} />
        </div>
      </div>

      <div className="panel">
        <h3>Recent jobs ({jobs.length})</h3>
        {jobs.length === 0 ? (
          <p className="muted">No jobs yet.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {jobs.slice(0, 20).map((j) => (
              <li key={j.id} className="issue" style={{ justifyContent: "space-between" }}>
                <span>
                  <span className={`pill ${j.status === "completed" ? "approved" : j.status === "failed" ? "rejected" : "queued"}`}>{j.status}</span>{" "}
                  <strong>{CATEGORY_META[j.category]?.label ?? j.category}</strong> ×{j.count}
                  <span className="muted"> · {styleLabel(j.styleId)}</span>
                  {j.dryRun ? <span className="muted"> · dry-run</span> : <span className="muted"> · ${ (j.actualCost ?? j.estimatedCost).toFixed(3) }</span>}
                </span>
                {(j.status === "queued" || j.status === "running" || j.status === "draft") && (
                  <button className="btn" onClick={() => cancelJob(j)}>Cancel</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ textAlign: "center", minWidth: 90, flex: 1 }}>
      <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{value}</div>
      <div className="muted" style={{ fontSize: "0.72rem" }}>{label}</div>
    </div>
  );
}
