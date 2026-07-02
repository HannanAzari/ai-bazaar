import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AssetReviewClient, type ReviewData } from "./asset-review-client";

// Internal, unlinked P0 asset-review tool. Reads the M9.2 validation report +
// generated candidates directly from disk and lets a human approve / reject / mark
// for regenerate (decisions are held client-side + exportable — nothing on disk is
// modified, no asset is changed, nothing is regenerated). Not linked from the app.

export const metadata = {
  title: "P0 Asset Review — internal",
  robots: { index: false, follow: false },
};

// Always re-read the report on request so the page reflects the latest run.
export const dynamic = "force-dynamic";

const REPORT = "metadata/reports/production-p0-validation.json";

/** `public/nests/…` (repo-relative) → `/nests/…` (served URL). */
function toUrl(p?: string): string | undefined {
  return p ? "/" + p.replace(/^public\//, "") : undefined;
}

type RawCandidate = {
  candidate: number;
  status: string;
  error?: string;
  totalScore?: number;
  scores?: Record<string, number>;
  issues?: string[];
  notes?: string[];
  transparency?: Record<string, unknown>;
  aspectRatio?: { target?: string | null; actual?: number | string; ok?: boolean };
  editableSurface?: { region?: number[]; stddev?: number; emptyEnough?: boolean } | null;
  variants?: Record<string, { path: string; kb: number }>;
  masterPng?: string;
  cutoutPng?: string;
};

type RawAsset = {
  assetId: string;
  kind: string;
  tier?: string | null;
  modelUsed: string;
  masterResolution: number[];
  aspectRatio: string;
  transparencyRequired: boolean;
  editableSurfaceSpec?: unknown;
  promptUsed: string;
  candidateCount: number;
  selectedCandidate: number | null;
  recommendation: string;
  approved: boolean;
  candidates: RawCandidate[];
};

type RawReport = {
  generatedAt: string;
  model: string;
  candidatesPerAsset: number | null;
  generationBlocker?: unknown;
  counts?: Record<string, number>;
  scoreDimensions?: string[];
  scoreNote?: string;
  assets: RawAsset[];
};

function loadReport(): { data: ReviewData | null; error?: string } {
  let raw: RawReport;
  try {
    raw = JSON.parse(readFileSync(join(process.cwd(), REPORT), "utf8")) as RawReport;
  } catch {
    return { data: null, error: `Could not read ${REPORT}. Run the P0 pipeline first.` };
  }
  const data: ReviewData = {
    generatedAt: raw.generatedAt,
    model: raw.model,
    candidatesPerAsset: raw.candidatesPerAsset ?? null,
    counts: raw.counts ?? {},
    scoreDimensions: raw.scoreDimensions ?? [],
    scoreNote: raw.scoreNote ?? "",
    blocked: !!raw.generationBlocker,
    assets: raw.assets.map((a) => ({
      assetId: a.assetId,
      kind: a.kind,
      tier: a.tier ?? null,
      model: a.modelUsed,
      masterResolution: a.masterResolution,
      aspectRatio: a.aspectRatio,
      transparencyRequired: a.transparencyRequired,
      editableSurfaceSpec: a.editableSurfaceSpec ?? null,
      recommendation: a.recommendation,
      selectedCandidate: a.selectedCandidate,
      prompt: a.promptUsed,
      candidates: a.candidates.map((c) => ({
        n: c.candidate,
        status: c.status,
        error: c.error,
        totalScore: c.totalScore ?? null,
        scores: c.scores ?? {},
        issues: c.issues ?? [],
        notes: c.notes ?? [],
        transparency: c.transparency ?? {},
        aspect: c.aspectRatio ?? {},
        editableSurface: c.editableSurface ?? null,
        imageUrl: toUrl(c.variants?.standard?.path),
        focusUrl: toUrl(c.variants?.focus?.path),
        masterUrl: toUrl(c.masterPng),
        cutoutUrl: toUrl(c.cutoutPng),
        variantKb: {
          mobile: c.variants?.mobile?.kb ?? null,
          standard: c.variants?.standard?.kb ?? null,
          focus: c.variants?.focus?.kb ?? null,
        },
      })),
    })),
  };
  return { data };
}

export default function AssetReviewPage() {
  const { data, error } = loadReport();

  if (!data) {
    return (
      <section className="shell space-y-4 py-10">
        <p className="eyebrow text-terracotta">P0 asset review · internal</p>
        <h1 className="display text-3xl">No validation report found</h1>
        <p className="max-w-xl text-sm text-ink-soft">{error}</p>
        <p className="max-w-xl text-sm text-ink-soft">
          Expected <code>{REPORT}</code>. Run{" "}
          <code>node scripts/generate-p0-pilot.mjs &amp;&amp; python3 scripts/process-validate-p0.py</code>.
        </p>
      </section>
    );
  }

  return <AssetReviewClient data={data} />;
}
