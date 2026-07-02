"use client";

import { useEffect, useMemo, useState } from "react";

// Per-candidate human decision. Held in localStorage + exportable JSON only — this
// tool never writes to disk, never modifies an asset, never regenerates anything.
type Decision = "approved" | "rejected" | "regenerate";

export type ReviewCandidate = {
  n: number;
  status: string;
  error?: string;
  totalScore: number | null;
  scores: Record<string, number>;
  issues: string[];
  notes: string[];
  transparency: Record<string, unknown>;
  aspect: { target?: string | null; actual?: number | string; ok?: boolean };
  editableSurface: { region?: number[]; stddev?: number; emptyEnough?: boolean } | null;
  imageUrl?: string;
  focusUrl?: string;
  masterUrl?: string;
  cutoutUrl?: string;
  variantKb: { mobile: number | null; standard: number | null; focus: number | null };
};

export type ReviewAsset = {
  assetId: string;
  kind: string;
  tier: string | null;
  model: string;
  masterResolution: number[];
  aspectRatio: string;
  transparencyRequired: boolean;
  editableSurfaceSpec: unknown;
  recommendation: string;
  selectedCandidate: number | null;
  prompt: string;
  candidates: ReviewCandidate[];
};

export type ReviewData = {
  generatedAt: string;
  model: string;
  candidatesPerAsset: number | null;
  counts: Record<string, number>;
  scoreDimensions: string[];
  scoreNote: string;
  blocked: boolean;
  assets: ReviewAsset[];
};

const STORAGE_KEY = "nestudio-asset-review-p0"; // design-tool only; not app demo state
const key = (assetId: string, n: number) => `${assetId}::c${n}`;

const DECISION_STYLE: Record<Decision, string> = {
  approved: "bg-[#4d7358] text-white border-[#4d7358]",
  rejected: "bg-[#a94f5c] text-white border-[#a94f5c]",
  regenerate: "bg-[#d9913c] text-white border-[#d9913c]",
};

function fmt(n: number | null | undefined, d = 1) {
  return typeof n === "number" ? n.toFixed(d) : "—";
}

export function AssetReviewClient({ data }: { data: ReviewData }) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDecisions(JSON.parse(raw) as Record<string, Decision>);
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(decisions));
    } catch {
      /* ignore */
    }
  }, [decisions, loaded]);

  function setDecision(assetId: string, n: number, value: Decision) {
    setDecisions((prev) => {
      const k = key(assetId, n);
      const next = { ...prev };
      if (next[k] === value) {
        delete next[k]; // toggle off
        return next;
      }
      // "approved" is exclusive within an asset — only one candidate can be approved.
      if (value === "approved") {
        for (const c of data.assets.find((a) => a.assetId === assetId)?.candidates ?? []) {
          if (next[key(assetId, c.n)] === "approved") delete next[key(assetId, c.n)];
        }
      }
      next[k] = value;
      return next;
    });
  }

  const summary = useMemo(() => {
    let approved = 0, rejected = 0, regenerate = 0;
    for (const v of Object.values(decisions)) {
      if (v === "approved") approved++;
      else if (v === "rejected") rejected++;
      else if (v === "regenerate") regenerate++;
    }
    const assetsWithApproval = new Set(
      Object.entries(decisions).filter(([, v]) => v === "approved").map(([k]) => k.split("::")[0]),
    ).size;
    return { approved, rejected, regenerate, assetsWithApproval, undecidedAssets: data.assets.length - assetsWithApproval };
  }, [decisions, data.assets.length]);

  const exportPayload = useMemo(
    () => ({
      tool: "nestudio-p0-asset-review",
      reviewedAt: new Date().toISOString(),
      report: { generatedAt: data.generatedAt, model: data.model },
      decisions: Object.entries(decisions).map(([k, decision]) => {
        const [assetId, cn] = k.split("::");
        return { assetId, candidate: Number(cn.replace("c", "")), decision };
      }),
    }),
    [decisions, data.generatedAt, data.model],
  );

  async function copyDecisions() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportPayload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function downloadDecisions() {
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "p0-asset-review-decisions.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="shell space-y-8 py-8">
      <header className="space-y-2">
        <p className="eyebrow text-terracotta">P0 asset review · internal</p>
        <h1 className="display text-3xl">Review the P0 candidates</h1>
        <p className="max-w-2xl text-sm text-ink-soft">
          {data.assets.length} assets · {data.candidatesPerAsset ?? "—"} candidates each · model{" "}
          <code>{data.model}</code> · generated {new Date(data.generatedAt).toLocaleString()}. Decisions are
          stored in your browser and exportable — <strong>nothing on disk is changed, no asset is modified,
          nothing is regenerated.</strong>
        </p>
        {data.scoreNote ? <p className="max-w-2xl text-xs text-ink-soft">Scoring note: {data.scoreNote}</p> : null}
      </header>

      {/* sticky action bar */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-[#e0d5b8] bg-[#f7f0dd]/95 px-4 py-3 text-sm shadow-sm backdrop-blur">
        <span className="font-bold">Decisions:</span>
        <span className="rounded-full bg-[#4d7358] px-2 py-0.5 text-xs font-bold text-white">✓ {summary.approved} approved</span>
        <span className="rounded-full bg-[#a94f5c] px-2 py-0.5 text-xs font-bold text-white">✕ {summary.rejected} rejected</span>
        <span className="rounded-full bg-[#d9913c] px-2 py-0.5 text-xs font-bold text-white">↻ {summary.regenerate} regenerate</span>
        <span className="text-ink-soft">
          {summary.assetsWithApproval}/{data.assets.length} assets have an approved pick
          {summary.undecidedAssets > 0 ? ` · ${summary.undecidedAssets} still open` : ""}
        </span>
        <span className="ml-auto flex gap-2">
          <button onClick={copyDecisions} className="rounded-lg border border-[#c9b98a] bg-white px-3 py-1 text-xs font-bold hover:bg-[#f0e9d4]">
            {copied ? "Copied ✓" : "Copy decisions JSON"}
          </button>
          <button onClick={downloadDecisions} className="rounded-lg border border-[#c9b98a] bg-white px-3 py-1 text-xs font-bold hover:bg-[#f0e9d4]">
            Download JSON
          </button>
        </span>
      </div>

      {data.assets.map((asset) => (
        <AssetRow key={asset.assetId} asset={asset} decisions={decisions} onDecide={setDecision} />
      ))}
    </section>
  );
}

function AssetRow({
  asset,
  decisions,
  onDecide,
}: {
  asset: ReviewAsset;
  decisions: Record<string, Decision>;
  onDecide: (assetId: string, n: number, value: Decision) => void;
}) {
  return (
    <div className="rounded-3xl border border-[#e0d5b8] bg-[#efe7cf] p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="display text-xl">{asset.assetId}</h2>
        <span className="rounded-full bg-[#dcd0ad] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
          {asset.kind}{asset.tier ? ` · ${asset.tier}` : ""}
        </span>
        <span className="text-xs text-ink-soft">
          master {asset.masterResolution.join("×")} · {asset.aspectRatio} · transparency{" "}
          {asset.transparencyRequired ? "required" : "no (opaque)"}
        </span>
        {asset.selectedCandidate ? (
          <span className="rounded-full border border-[#c9b98a] px-2 py-0.5 text-[11px] font-bold text-ink-soft">
            auto-pick ★ c{asset.selectedCandidate}
          </span>
        ) : null}
        <span className="w-full text-xs text-ink-soft sm:w-auto">{asset.recommendation}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {asset.candidates.map((c) => (
          <CandidateCard
            key={c.n}
            asset={asset}
            c={c}
            decision={decisions[key(asset.assetId, c.n)]}
            selected={asset.selectedCandidate === c.n}
            onDecide={onDecide}
          />
        ))}
      </div>
    </div>
  );
}

function CandidateCard({
  asset,
  c,
  decision,
  selected,
  onDecide,
}: {
  asset: ReviewAsset;
  c: ReviewCandidate;
  decision?: Decision;
  selected: boolean;
  onDecide: (assetId: string, n: number, value: Decision) => void;
}) {
  const t = c.transparency as {
    hasAlpha?: boolean;
    transparentFraction?: number;
    cutoutReliable?: boolean;
    cornersClear?: boolean;
    expectedOpaque?: boolean;
  };
  const failed = c.status !== "generated";

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border bg-white ${
        decision ? DECISION_STYLE[decision].split(" ").find((x) => x.startsWith("border-")) : "border-[#e0d5b8]"
      } ${selected ? "ring-2 ring-[#d9913c]" : ""}`}
    >
      {/* image on a checkerboard so alpha is visible (display aid only) */}
      <div
        className="relative flex aspect-square items-center justify-center"
        style={{
          backgroundColor: "#ece4d0",
          backgroundImage:
            "linear-gradient(45deg,#d9cead 25%,transparent 25%),linear-gradient(-45deg,#d9cead 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d9cead 75%),linear-gradient(-45deg,transparent 75%,#d9cead 75%)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0,0 10px,10px -10px,-10px 0",
        }}
      >
        {failed ? (
          <span className="px-3 text-center text-xs font-bold text-[#a94f5c]">failed: {c.error?.slice(0, 90)}</span>
        ) : c.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local candidate art; next/image adds no value on this internal tool
          <img src={c.imageUrl} alt={`${asset.assetId} candidate ${c.n}`} className="max-h-full max-w-full object-contain" loading="lazy" />
        ) : (
          <span className="text-xs text-ink-soft">no image</span>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-bold text-white">
          c{c.n}{selected ? " ★" : ""}
        </span>
        <span className="absolute right-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-bold text-white">
          {fmt(c.totalScore, 1)}/50
        </span>
      </div>

      {!failed ? (
        <div className="flex flex-1 flex-col gap-2 p-3 text-xs text-ink">
          {/* score breakdown */}
          <div className="grid grid-cols-5 gap-1 text-center">
            {[
              ["DNA", c.scores.dnaAdherence],
              ["Comp", c.scores.composition],
              ["Alpha", c.scores.transparency],
              ["Focus", c.scores.focusReadability],
              ["Surf", c.scores.editableSurfaceSuitability],
            ].map(([label, v]) => (
              <div key={String(label)} className="rounded bg-[#f2ead4] py-1">
                <div className="text-[9px] uppercase text-ink-soft">{label}</div>
                <div className="font-bold">{fmt(v as number, 1)}</div>
              </div>
            ))}
          </div>

          {/* transparency + aspect */}
          <div className="space-y-0.5">
            <div>
              <span className="text-ink-soft">Transparency:</span>{" "}
              {asset.transparencyRequired ? (
                <span className={t.hasAlpha ? "" : "font-bold text-[#a94f5c]"}>
                  {t.hasAlpha ? "alpha ✓" : "NO alpha"} · {Math.round((t.transparentFraction ?? 0) * 100)}% clear ·{" "}
                  {t.cutoutReliable ? "cut-out reliable" : "cut-out UNRELIABLE"}
                </span>
              ) : (
                <span>opaque ✓</span>
              )}
            </div>
            <div>
              <span className="text-ink-soft">Aspect:</span>{" "}
              <span className={c.aspect.ok ? "" : "font-bold text-[#d9913c]"}>
                {String(c.aspect.actual)} vs {c.aspect.target ?? "—"} {c.aspect.ok ? "✓" : "off"}
              </span>
            </div>
            {c.editableSurface ? (
              <div>
                <span className="text-ink-soft">Editable surface:</span>{" "}
                <span className={c.editableSurface.emptyEnough ? "" : "text-[#d9913c]"}>
                  {c.editableSurface.emptyEnough ? "empty ✓" : "not empty"} (σ {fmt(c.editableSurface.stddev, 0)})
                </span>
              </div>
            ) : null}
          </div>

          {c.issues.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-4 text-[#a05a2c]">
              {c.issues.map((i, idx) => (
                <li key={idx}>{i}</li>
              ))}
            </ul>
          ) : null}

          {c.notes.length > 0 ? (
            <details className="text-ink-soft">
              <summary className="cursor-pointer select-none">notes ({c.notes.length})</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {c.notes.map((n, idx) => (
                  <li key={idx}>{n}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="mt-auto flex flex-wrap gap-2 pt-1 text-[11px] text-ink-soft">
            {c.masterUrl ? (
              <a href={c.masterUrl} target="_blank" rel="noreferrer" className="underline">
                master
              </a>
            ) : null}
            {c.cutoutUrl ? (
              <a href={c.cutoutUrl} target="_blank" rel="noreferrer" className="underline">
                cut-out
              </a>
            ) : null}
            {c.focusUrl ? (
              <a href={c.focusUrl} target="_blank" rel="noreferrer" className="underline">
                focus ({fmt(c.variantKb.focus, 0)}KB)
              </a>
            ) : null}
          </div>

          {/* decision buttons */}
          <div className="grid grid-cols-3 gap-1 pt-1">
            {(["approved", "rejected", "regenerate"] as Decision[]).map((d) => (
              <button
                key={d}
                onClick={() => onDecide(asset.assetId, c.n, d)}
                className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold capitalize transition ${
                  decision === d ? DECISION_STYLE[d] : "border-[#c9b98a] bg-white text-ink hover:bg-[#f0e9d4]"
                }`}
              >
                {d === "approved" ? "Approve" : d === "rejected" ? "Reject" : "Regenerate"}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3">
          <div className="grid grid-cols-3 gap-1">
            {(["approved", "rejected", "regenerate"] as Decision[]).map((d) => (
              <button
                key={d}
                onClick={() => onDecide(asset.assetId, c.n, d)}
                className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold capitalize ${
                  decision === d ? DECISION_STYLE[d] : "border-[#c9b98a] bg-white text-ink hover:bg-[#f0e9d4]"
                }`}
              >
                {d === "approved" ? "Approve" : d === "rejected" ? "Reject" : "Regenerate"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
