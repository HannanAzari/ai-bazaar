"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Download, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { generateAsset, type GeneratedAsset } from "@/lib/ai";
import { inventory, assetFromGenerated } from "@/lib/ai-inventory";
import { useInventory } from "@/lib/ai-inventory/react";
import { useDevMode } from "@/lib/dev-mode";
import { getAssets } from "@/lib/nest-production-library";
import type { InventoryAsset } from "@/lib/ai-inventory/types";
import { REFERENCE_COLLECTION } from "../reference-collection";

const NEST_TINT = "linear-gradient(160deg,#f3e9d2,#e7d6ac)";

// ── AI Asset Review (dev-mode) ───────────────────────────────────────────────
// The internal review lens over the inventory: Approve / Reject / Regenerate /
// Duplicate / Export. Hidden behind developer mode. Reuses the SAME engine +
// inventory as the Studio — this is the seed of the Admin Asset Factory, which
// will differ only in publishing approved assets to the global library
// (publishTarget "globalLibrary") instead of a single user's inventory.

const CHECKER = "repeating-conic-gradient(#00000010 0% 25%, transparent 0% 50%) 50% / 18px 18px";

export function ReviewClient() {
  const dev = useDevMode();
  const assets = useInventory();
  const official = useMemo(() => getAssets({ onlyVisible: true }).slice(0, 8), []);
  const [collection, setCollection] = useState<GeneratedAsset[]>([]);
  const [running, setRunning] = useState(false);
  const [onTint, setOnTint] = useState(true);

  const runConsistencyTest = useCallback(async () => {
    setRunning(true);
    setCollection([]);
    for (const ref of REFERENCE_COLLECTION) {
      try {
        const g = await generateAsset("furniture", ref.input, { subject: ref.subject, refinePasses: 0 });
        setCollection((prev) => [...prev, g]);
      } catch {
        /* skip a failed item, keep the run going */
      }
    }
    setRunning(false);
  }, []);

  const setStatus = useCallback((a: InventoryAsset, reviewStatus: InventoryAsset["reviewStatus"]) => {
    inventory.save({ ...a, reviewStatus });
  }, []);

  const duplicate = useCallback((a: InventoryAsset) => {
    inventory.save({ ...a, id: `${a.id}-copy-${Math.abs((Date.now() / 1000) | 0) % 100000}`, name: `${a.name} copy`, reviewStatus: "pending" });
  }, []);

  const exportAsset = useCallback((a: InventoryAsset) => {
    const link = document.createElement("a");
    link.href = a.imageUrl;
    link.download = `${a.name.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.click();
  }, []);

  const regenerate = useCallback(async (a: InventoryAsset) => {
    // Reprocess the current asset through the engine again (a light re-refine).
    const result = await generateAsset(a.kind, { dataUrl: a.imageUrl, fileName: `${a.id}.png`, mimeType: "image/png" }, { subject: a.metadata.subject });
    inventory.save({ ...assetFromGenerated(result, a.publishTarget), id: a.id, reviewStatus: "pending" });
  }, []);

  if (!dev) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-parchment p-8 text-center">
        <div className="space-y-3">
          <p className="text-sm font-bold text-ink/60">The review panel is developer-only.</p>
          <Link href="/creator-studio?dev=1" className="inline-flex rounded-xl bg-terracotta px-5 py-3 text-sm font-black text-parchment">Enable developer mode</Link>
        </div>
      </div>
    );
  }

  const counts = {
    pending: assets.filter((a) => (a.reviewStatus ?? "pending") === "pending").length,
    approved: assets.filter((a) => a.reviewStatus === "approved").length,
    rejected: assets.filter((a) => a.reviewStatus === "rejected").length,
  };

  return (
    <div className="min-h-[100dvh] bg-parchment pb-16">
      <header className="sticky top-0 z-10 border-b border-timber/10 bg-parchment/85 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href="/creator-studio" className="grid size-9 place-items-center rounded-full bg-white/70 shadow-soft">
            <ArrowLeft className="size-4 text-ink/70" />
          </Link>
          <div>
            <p className="eyebrow text-teal">Developer · Asset Factory (preview)</p>
            <h1 className="display text-lg leading-none">Asset Review</h1>
          </div>
          <span className="ml-auto text-[11px] font-bold text-ink/45">
            {counts.pending} pending · {counts.approved} approved · {counts.rejected} rejected
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 pt-4">
        {/* Phase 5 — official reference: the target look, for eyeballing */}
        <section>
          <h2 className="mb-2 text-xs font-black uppercase tracking-wide text-ink/45">Official Nestudio reference</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {official.map((a) => (
              <div key={a.id} className="shrink-0">
                <div className="grid size-16 place-items-center rounded-xl bg-white/70 p-1 shadow-soft">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.variants?.standard ?? a.cutoutUrl ?? a.imageUrl} alt={a.name} className="max-h-full max-w-full object-contain" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Phase 7 — consistency test: generate the whole collection, judge coherence */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wide text-ink/45">Consistency test · {REFERENCE_COLLECTION.length} objects</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setOnTint((v) => !v)} className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold text-ink/55 shadow-soft">{onTint ? "On Nest" : "On alpha"}</button>
              <button onClick={runConsistencyTest} disabled={running} className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-3 py-1.5 text-[11px] font-black text-parchment disabled:opacity-50">
                {running ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                {running ? `Generating ${collection.length}/${REFERENCE_COLLECTION.length}` : "Run consistency test"}
              </button>
            </div>
          </div>
          {collection.length || running ? (
            <div className="grid grid-cols-4 gap-1.5 rounded-2xl p-2" style={{ background: onTint ? NEST_TINT : CHECKER }}>
              {collection.map((g) => (
                <div key={g.id} className="grid aspect-square place-items-center p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.png.dataUrl} alt={g.metadata.subject} className="max-h-full max-w-full object-contain" />
                </div>
              ))}
              {running ? Array.from({ length: REFERENCE_COLLECTION.length - collection.length }).map((_, i) => (
                <div key={`ph${i}`} className="grid aspect-square animate-pulse place-items-center rounded-lg bg-white/30" />
              )) : null}
            </div>
          ) : (
            <p className="rounded-2xl bg-white/60 px-4 py-6 text-center text-[12px] text-ink/45">
              Generate all twelve objects and judge them as a set — every asset should feel like one artist.
            </p>
          )}
        </section>

        {assets.length === 0 ? (
          <p className="rounded-2xl bg-white/60 px-4 py-10 text-center text-sm text-ink/45">
            No assets yet — generate some in the <Link href="/creator-studio" className="font-bold text-terracotta">Studio</Link>.
          </p>
        ) : (
          <div className="space-y-3">
            {assets.map((a) => {
              const q = a.metadata.quality;
              const status = a.reviewStatus ?? "pending";
              return (
                <div key={a.id} className="flex gap-3 rounded-2xl bg-white/70 p-3 shadow-soft">
                  <div className="grid size-24 shrink-0 place-items-center rounded-xl p-1.5" style={{ background: CHECKER }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.imageUrl} alt={a.name} className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="display text-sm leading-none">{a.name}</p>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase ${status === "approved" ? "bg-meadow-shade/15 text-meadow-shade" : status === "rejected" ? "bg-ember/15 text-ember" : "bg-ink/8 text-ink/50"}`}>{status}</span>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-ink/45">
                      {a.metadata.promptVersion} · {a.metadata.preset} · q{q ? Math.round(q.score * 100) : "—"} · {a.width}×{a.height}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Action onClick={() => setStatus(a, "approved")} tone="good"><Check className="size-3" /> Approve</Action>
                      <Action onClick={() => setStatus(a, "rejected")} tone="bad"><X className="size-3" /> Reject</Action>
                      <Action onClick={() => regenerate(a)}><RefreshCw className="size-3" /> Regenerate</Action>
                      <Action onClick={() => duplicate(a)}><Copy className="size-3" /> Duplicate</Action>
                      <Action onClick={() => exportAsset(a)}><Download className="size-3" /> Export</Action>
                      <Action onClick={() => inventory.remove(a.id)}>Delete</Action>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Action({ children, onClick, tone }: { children: ReactNode; onClick: () => void; tone?: "good" | "bad" }) {
  const cls = tone === "good" ? "bg-meadow-shade/12 text-meadow-shade" : tone === "bad" ? "bg-ember/12 text-ember" : "bg-ink/6 text-ink/60";
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold ${cls}`}>
      {children}
    </button>
  );
}
