"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildNestPrompt, scoreNestDna, NEST_EDITOR_ASPECT } from "@/lib/nest-factory/nest-dna";
import type { NestSpec } from "@/lib/nest-factory/translator";
import { clearFounderToken, founderHeaders, hasFounderToken, setFounderToken } from "@/lib/founder-token";
import { publishFounderNest } from "@/lib/nest-factory/founder-publish-nest";

/* Founder-created empty Nest, mirrored locally (Supabase publish is the source of truth). */
type SavedNest = {
  id: string; name: string; spec: NestSpec; finalDataUrl: string;
  costUsd: number | null; dnaScore: number; createdAt: string;
  published?: boolean; imageUrl?: string;
};

type Stage = "input" | "interpreting" | "spec" | "generating" | "review" | "publishing" | "saved";

export function NestFactoryClient() {
  const [stage, setStage] = useState<Stage>("input");
  const [description, setDescription] = useState("");
  const [spec, setSpec] = useState<NestSpec | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [costUsd, setCostUsd] = useState<number | null>(null);
  const [proud, setProud] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [saved, setSaved] = useState<SavedNest | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Founder gate (identical to Asset Factory).
  const [authed, setAuthed] = useState(true);
  const [tokenInput, setTokenInput] = useState("");
  useEffect(() => { setAuthed(hasFounderToken()); }, []);
  const busy = useRef(false);

  const reset = () => { setStage("input"); setSpec(null); setImage(null); setCostUsd(null); setProud(null); setError(null); setProgress(""); setSaved(null); busy.current = false; };
  const saveToken = () => { const t = tokenInput.trim(); if (!t) return; setFounderToken(t); setAuthed(true); setTokenInput(""); setError(null); };
  const onAuthError = () => { clearFounderToken(); setAuthed(false); setError("Founder access expired or invalid — re-enter your access code."); };

  const dna = spec ? scoreNestDna(spec) : null;

  /* 1 → 2: interpret the request into a Nest DNA spec. */
  const interpret = useCallback(async () => {
    if (!description.trim() || busy.current) return;
    busy.current = true;
    setError(null); setStage("interpreting");
    try {
      const res = await fetch("/api/ai/nest/translate", {
        method: "POST", headers: founderHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ description: description.trim() }),
      });
      if (res.status === 401) { onAuthError(); setStage("input"); return; }
      const j = await res.json();
      if (!res.ok || !j.spec) throw new Error(j.error || "Could not interpret the room.");
      setSpec(j.spec as NestSpec); setStage("spec");
    } catch (e) { setError((e as Error).message); setStage("input"); }
    finally { busy.current = false; }
  }, [description]);

  /* 4: generate ONE empty Nest (text-to-image — architecture only). */
  const generate = useCallback(async () => {
    if (!spec || busy.current) return;
    if (!spec.moderation.ok) { setError("This request was flagged by moderation and cannot be generated."); return; }
    busy.current = true;
    setError(null); setStage("generating"); setImage(null); setProud(null);
    setProgress("Building the empty Nest…");
    try {
      const { positive, negative } = buildNestPrompt(spec);
      const r = await fetch("/api/ai/nest/generate", {
        method: "POST", headers: founderHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ positive, negative, id: `nest-${Date.now().toString(36)}` }),
      });
      if (r.status === 401) { onAuthError(); setStage("spec"); return; }
      const rj = await r.json();
      if (!r.ok || !rj.imageDataUrl) throw new Error(rj.error || "Nest generation failed.");
      setImage(rj.imageDataUrl as string); setCostUsd(rj.costUsd ?? null); setStage("review");
    } catch (e) { setError((e as Error).message); setStage("spec"); }
    finally { busy.current = false; }
  }, [spec]);

  /* 7: approve → publish to the Nest Library (nest_backgrounds), then mirror locally. */
  const approve = useCallback(async () => {
    if (!spec || !image || proud !== true || busy.current) return;
    busy.current = true;
    setError(null); setStage("publishing");
    const nest: SavedNest = {
      id: `nest-${spec.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-v1`,
      name: spec.name, spec, finalDataUrl: image,
      costUsd, dnaScore: scoreNestDna(spec).score, createdAt: new Date().toISOString(),
    };
    const pub = await publishFounderNest({ spec, finalDataUrl: image });
    if (!pub.ok) {
      busy.current = false;
      if (pub.status === 401) { onAuthError(); setStage("review"); return; }
      setError(`Publish failed: ${pub.error}. Saved to your local library — you can retry Approve.`);
    } else {
      nest.published = true; nest.imageUrl = pub.imageUrl; nest.id = pub.id;
    }
    try {
      const key = "nestudio:founder-nest-library:v1";
      const lib = JSON.parse(localStorage.getItem(key) || "[]") as SavedNest[];
      localStorage.setItem(key, JSON.stringify([nest, ...lib.filter((n) => n.id !== nest.id)]));
    } catch { /* non-fatal */ }
    busy.current = false;
    if (pub.ok) { setSaved(nest); setStage("saved"); }
  }, [spec, image, proud, costUsd]);

  // ── Founder gate screen (identical to Asset Factory) ──
  if (!authed) {
    return (
      <div
        className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-white px-6 text-neutral-900"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <h1 className="text-xl font-black tracking-tight">Nest Factory</h1>
        <p className="mt-1 text-sm text-neutral-500">Founder access required. Enter your access code to create and publish Nests.</p>
        {error && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
        <input
          type="password" inputMode="text" autoComplete="off" value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") saveToken(); }}
          placeholder="Founder access code"
          className="mt-4 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-base outline-none focus:border-neutral-400"
        />
        <button onClick={saveToken} disabled={!tokenInput.trim()} className="mt-3 w-full rounded-2xl bg-neutral-900 py-3.5 text-sm font-bold text-white disabled:opacity-30">Enter Factory</button>
        <p className="mt-3 text-[11px] leading-relaxed text-neutral-400">The code is checked on the server. Nothing is generated or published without it.</p>
      </div>
    );
  }

  return (
    <div
      className="mx-auto min-h-screen w-full max-w-md bg-white px-4 text-neutral-900"
      style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))", paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}
    >
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black tracking-tight">Nest Factory</h1>
          <p className="text-[11px] text-neutral-500">Describe an empty room — Nestudio builds the stage.</p>
        </div>
        {stage !== "input" && <button onClick={reset} className="text-xs font-semibold text-neutral-500">Start over</button>}
      </header>

      {error && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

      {/* 1 · INPUT */}
      {stage === "input" && (
        <div className="space-y-3">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
            placeholder="e.g. A warm modern music studio with a large back wall, wooden floor and soft evening light."
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-[15px] outline-none focus:border-neutral-400" />
          <p className="text-[11px] text-neutral-500">Architecture only — walls, floor, ceiling, windows, light, mood. No furniture; creators decorate it later.</p>
        </div>
      )}

      {stage === "interpreting" && <Centered>Interpreting the room…</Centered>}

      {/* 2/3 · SPEC PREVIEW */}
      {stage === "spec" && spec && (
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Interpreted Nest</p>
          <input value={spec.name} onChange={(e) => setSpec({ ...spec, name: e.target.value })}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-base font-bold" />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Field k="Category" v={spec.category} />
            <Field k="Mood" v={spec.mood} />
            <Field k="Style" v={spec.architecturalStyle} />
            <Field k="Walls" v={spec.walls} />
            <Field k="Floor" v={spec.floorMaterial} />
            <Field k="Windows" v={spec.windows} />
            <Field k="Lighting" v={`${spec.lighting} · ${spec.timeOfDay}`} />
            <Field k="Est. cost" v={`$${spec.estimatedCostUsd.toFixed(2)}`} />
          </div>
          {spec.recommendedAssetTags.length > 0 && <p className="text-[11px] text-neutral-500">suits: {spec.recommendedAssetTags.join(", ")}</p>}
          <Warn ok={spec.brandNeutral.ok} label="Brand-neutral" note={spec.brandNeutral.note || "generic — no brand"} />
          <Warn ok={spec.moderation.ok} label="Safety" note={spec.moderation.note || "passed"} />
          <label className="block text-[11px] font-semibold text-neutral-500">Room description (editable)
            <textarea value={spec.generationSubject} onChange={(e) => setSpec({ ...spec, generationSubject: e.target.value })} rows={2}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm font-normal text-neutral-800" />
          </label>
        </div>
      )}

      {stage === "generating" && <Centered><div className="text-center"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-800" />{progress || "Generating…"}</div></Centered>}
      {stage === "publishing" && <Centered><div className="text-center"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-800" />Publishing to your Nest Library…</div></Centered>}

      {/* 5/6 · REVIEW */}
      {stage === "review" && image && spec && dna && (
        <div className="space-y-3">
          <div className="w-full overflow-hidden rounded-2xl border border-neutral-200" style={{ aspectRatio: NEST_EDITOR_ASPECT.replace(":", " / ") }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}<img src={image} alt={spec.name} className="h-full w-full object-cover" />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold">{spec.name}</span>
            <span className="text-neutral-500">${(costUsd ?? 0).toFixed(3)} · DNA {(dna.score * 100).toFixed(0)}%</span>
          </div>

          <button onClick={() => setShowDetails((s) => !s)} className="text-[11px] font-semibold text-neutral-500">{showDetails ? "Hide" : "Details"} (DNA checks · cost · camera)</button>
          {showDetails && (
            <div className="space-y-2 rounded-2xl border border-neutral-100 bg-neutral-50 p-3 text-[11px]">
              <div className="grid grid-cols-2 gap-1">
                {dna.checks.map((c) => <p key={c.label}>{c.ok ? "✓" : "⚠"} {c.label}</p>)}
              </div>
              <p>est ${spec.estimatedCostUsd.toFixed(2)} · actual ${(costUsd ?? 0).toFixed(3)} · camera {spec.compatibilityVersion} · raw = final (no post)</p>
            </div>
          )}

          <div className="rounded-2xl border border-neutral-200 p-3">
            <p className="mb-2 text-center text-sm font-bold">Would I proudly let creators build inside this Nest?</p>
            <div className="flex gap-2">
              <button onClick={() => setProud(true)} className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${proud === true ? "bg-emerald-600 text-white" : "border border-neutral-200 text-neutral-700"}`}>Yes</button>
              <button onClick={() => setProud(false)} className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${proud === false ? "bg-neutral-800 text-white" : "border border-neutral-200 text-neutral-700"}`}>No</button>
            </div>
            {proud === false && <p className="mt-2 text-center text-[11px] text-neutral-500">Regenerate or edit the room below.</p>}
          </div>
        </div>
      )}

      {/* SAVED */}
      {stage === "saved" && saved && (
        <div className="space-y-3 text-center">
          <div className="mx-auto w-2/3 overflow-hidden rounded-2xl border border-neutral-200" style={{ aspectRatio: NEST_EDITOR_ASPECT.replace(":", " / ") }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}<img src={saved.finalDataUrl} alt={saved.name} className="h-full w-full object-cover" />
          </div>
          <p className="text-lg font-black">✓ {saved.name} published</p>
          <p className="text-xs text-neutral-500">Live in your Nest Library · id <span className="font-mono">{saved.id}</span></p>
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-700">Open Create → Build My Own — it&apos;s selectable now as an empty Nest, ready to decorate. Survives reload.</p>
          <button onClick={reset} className="rounded-2xl bg-neutral-900 px-6 py-3 text-sm font-bold text-white">Create another</button>
        </div>
      )}

      {/* sticky action bar */}
      <StickyBar>
        {stage === "input" && <Primary onClick={interpret} disabled={!description.trim()}>Interpret →</Primary>}
        {stage === "spec" && spec && (<><Secondary onClick={reset}>Edit</Secondary><Primary onClick={generate} disabled={!spec.moderation.ok}>Generate · ${spec.estimatedCostUsd.toFixed(2)}</Primary></>)}
        {stage === "review" && (<>
          <Secondary onClick={generate}>Regenerate</Secondary>
          <Secondary onClick={() => setStage("spec")}>Edit</Secondary>
          <Primary onClick={approve} disabled={proud !== true}>Approve &amp; Publish</Primary>
        </>)}
      </StickyBar>
    </div>
  );
}

/* ── small pieces (mirror Asset Factory) ── */
function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[40vh] items-center justify-center text-sm text-neutral-500">{children}</div>;
}
function Field({ k, v }: { k: string; v: string }) {
  return <div className="rounded-xl bg-neutral-50 px-3 py-2"><span className="text-[10px] uppercase tracking-wide text-neutral-400">{k}</span><div className="font-semibold text-neutral-800">{v}</div></div>;
}
function Warn({ ok, label, note }: { ok: boolean; label: string; note: string }) {
  return <div className={`rounded-xl px-3 py-2 text-[11px] ${ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}><b>{label}:</b> {ok ? "✓ " : "⚠ "}{note}</div>;
}
function StickyBar({ children }: { children: React.ReactNode }) {
  if (!children || (Array.isArray(children) && children.every((c) => !c))) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md gap-2 border-t border-neutral-100 bg-white/95 px-4 pt-3 backdrop-blur"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      {children}
    </div>
  );
}
function Primary({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className="flex-[2] rounded-2xl bg-neutral-900 py-3.5 text-sm font-bold text-white disabled:opacity-30">{children}</button>;
}
function Secondary({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="flex-1 rounded-2xl border border-neutral-200 py-3.5 text-sm font-semibold text-neutral-700">{children}</button>;
}
