"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RasterImage } from "@/lib/ai/types";
import { toRaster } from "@/lib/ai/canvas";
import { getSegmenter, maskToCutout, sourceToCanvas, type SegMask } from "@/lib/segmentation";
import { generateAssetHonest, type HonestResult } from "@/lib/asset-pipeline";
import type { MaterialFamily, ObjectMaterial } from "@/lib/asset-pipeline/materials";
import type { NestudioSpec } from "@/lib/asset-pipeline/translator";
import { clearFounderToken, founderHeaders, hasFounderToken, setFounderToken } from "@/lib/founder-token";
import { publishFounderAsset } from "@/lib/nest/founder-publish";

/* Founder-created asset, saved locally (Supabase write is the provisioning-gated step). */
type SavedAsset = {
  id: string; name: string; spec: NestudioSpec; finalDataUrl: string;
  scope: "global" | "private-user"; ownerId: string | null;
  costUsd: number | null; pose?: HonestResult["pose"]; version: number; createdAt: string;
  published?: boolean; imageUrl?: string;
};

type Stage = "input" | "interpreting" | "spec" | "generating" | "review" | "publishing" | "saved";

const CHECKER: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg,#e3e3e3 25%,transparent 0),linear-gradient(-45deg,#e3e3e3 25%,transparent 0),linear-gradient(45deg,transparent 75%,#e3e3e3 0),linear-gradient(-45deg,transparent 75%,#e3e3e3 0)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
  backgroundColor: "#f4f4f4",
};

function materialFromSpec(spec: NestudioSpec): ObjectMaterial {
  const [primary, ...rest] = spec.materials;
  return { primary: (primary ?? "polymer") as MaterialFamily, accents: rest.map((f) => ({ family: f as MaterialFamily, part: "detail" })) };
}

export function AssetFactoryClient() {
  const [stage, setStage] = useState<Stage>("input");
  const [description, setDescription] = useState("");
  const [upload, setUpload] = useState<string | null>(null); // data URL of an uploaded reference
  const [spec, setSpec] = useState<NestudioSpec | null>(null);
  const [result, setResult] = useState<HonestResult | null>(null);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [proud, setProud] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [saved, setSaved] = useState<SavedAsset | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Founder gate — the Studio is founder-only. No token → show the gate screen; the
  // token rides every AI/publish call as `x-founder-token` and is verified server-side.
  const [authed, setAuthed] = useState(true); // assume true on server; corrected on mount
  const [tokenInput, setTokenInput] = useState("");
  useEffect(() => { setAuthed(hasFounderToken()); }, []);

  // Double-tap / re-entrancy guard: one in-flight expensive action at a time, so a
  // second tap (or a fast double-tap) can never launch a duplicate generation/publish.
  const busy = useRef(false);

  const reset = () => { setStage("input"); setSpec(null); setResult(null); setReferenceUrl(null); setProud(null); setError(null); setProgress(""); setSaved(null); busy.current = false; };

  const saveToken = () => { const t = tokenInput.trim(); if (!t) return; setFounderToken(t); setAuthed(true); setTokenInput(""); setError(null); };
  const onAuthError = () => { clearFounderToken(); setAuthed(false); setError("Founder access expired or invalid — re-enter your access code."); };

  /* Step 1 → 2: interpret the request into a Nestudio spec. */
  const interpret = useCallback(async () => {
    if (!description.trim() || busy.current) return;
    busy.current = true;
    setError(null); setStage("interpreting");
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST", headers: founderHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ description: description.trim(), hasReference: !!upload }),
      });
      if (res.status === 401) { onAuthError(); setStage("input"); return; }
      const j = await res.json();
      if (!res.ok || !j.spec) throw new Error(j.error || "Could not interpret the request.");
      setSpec(j.spec as NestudioSpec); setStage("spec");
    } catch (e) { setError((e as Error).message); setStage("input"); }
    finally { busy.current = false; }
  }, [description, upload]);

  /* Step 4: generate ONE candidate through the frozen pipeline (Path A studio-ref, or Path B upload). */
  const generate = useCallback(async () => {
    if (!spec || busy.current) return;
    if (!spec.moderation.ok) { setError("This request was flagged by moderation and cannot be generated."); return; }
    busy.current = true;
    setError(null); setStage("generating"); setResult(null); setProud(null);
    try {
      let sourceDataUrl = upload;
      if (!sourceDataUrl) {
        setProgress("Creating a studio reference…");
        const r = await fetch("/api/ai/reference", {
          method: "POST", headers: founderHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({ subject: spec.generationSubject, id: `factory-${Date.now().toString(36)}` }),
        });
        if (r.status === 401) { onAuthError(); setStage("spec"); return; }
        const rj = await r.json();
        if (!r.ok || !rj.imageDataUrl) throw new Error(rj.error || "Reference generation failed.");
        sourceDataUrl = rj.imageDataUrl as string;
      }
      setReferenceUrl(sourceDataUrl);
      setProgress("Preparing the object…");
      const canvas = await sourceToCanvas(sourceDataUrl!);
      const original = toRaster(canvas);
      const seg = await getSegmenter();
      let mask: SegMask | null = null;
      try { mask = (await seg.detect(canvas))[0]?.mask ?? null; } catch { /* fall through */ }
      if (!mask) { try { mask = await seg.segmentAtPoint(canvas, { x: 0.5, y: 0.5 }); } catch { /* none */ } }
      if (!mask) throw new Error("Could not isolate the object from the image.");
      const cutout: RasterImage = await maskToCutout(canvas, mask);

      setProgress("Rendering the Nestudio asset…");
      const material = materialFromSpec(spec);
      const res = await generateAssetHonest({
        cutout, original, subject: spec.generationSubject,
        mode: upload ? "preserve" : "simplify", material,
        authHeaders: founderHeaders(),
      });
      if (!res.ok) throw new Error(res.error || "Generation failed.");
      setResult(res); setStage("review");
    } catch (e) { setError((e as Error).message); setStage("spec"); }
    finally { busy.current = false; }
  }, [spec, upload]);

  /* Step 7: approve → publish to the global catalog (Supabase), then mirror locally. */
  const approve = useCallback(async () => {
    if (!spec || !result?.finished || proud !== true || busy.current) return;
    busy.current = true;
    setError(null); setStage("publishing");
    const finalDataUrl = result.finished.dataUrl;
    const asset: SavedAsset = {
      id: `ast-${spec.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-v1`,
      name: spec.name, spec, finalDataUrl,
      scope: "global", ownerId: null, // Founder Mode → global. User Mode later: scope "private-user", ownerId=userId.
      costUsd: result.costUsd, pose: result.pose, version: 1, createdAt: new Date().toISOString(),
    };
    // Canonical publish to Supabase (Storage + nest_assets) via the founder-gated route.
    const pub = await publishFounderAsset({ spec, finalDataUrl });
    if (!pub.ok) {
      busy.current = false;
      if (pub.status === 401) { onAuthError(); setStage("review"); return; }
      setError(`Publish failed: ${pub.error}. Saved to your local library — you can retry Approve.`);
    } else {
      asset.published = true; asset.imageUrl = pub.imageUrl; asset.id = pub.id;
    }
    // Local mirror (survives even if the network publish failed → retryable).
    try {
      const key = "nestudio:founder-library:v1";
      const lib = JSON.parse(localStorage.getItem(key) || "[]") as SavedAsset[];
      localStorage.setItem(key, JSON.stringify([asset, ...lib.filter((a) => a.id !== asset.id)]));
    } catch { /* non-fatal */ }
    busy.current = false;
    if (pub.ok) { setSaved(asset); setStage("saved"); }
  }, [spec, result, proud]);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setUpload(r.result as string);
    r.readAsDataURL(f);
  };

  // ── Founder gate screen ──
  if (!authed) {
    return (
      <div
        className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-white px-6 text-neutral-900"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <h1 className="text-xl font-black tracking-tight">Creation Studio</h1>
        <p className="mt-1 text-sm text-neutral-500">Founder access required. Enter your access code to create and publish.</p>
        {error && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
        <input
          type="password" inputMode="text" autoComplete="off" value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") saveToken(); }}
          placeholder="Founder access code"
          className="mt-4 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-base outline-none focus:border-neutral-400"
        />
        <button onClick={saveToken} disabled={!tokenInput.trim()} className="mt-3 w-full rounded-2xl bg-neutral-900 py-3.5 text-sm font-bold text-white disabled:opacity-30">Enter Studio</button>
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
          <h1 className="text-lg font-black tracking-tight">Asset Factory</h1>
          <p className="text-[11px] text-neutral-500">Describe it — Nestudio makes it belong.</p>
        </div>
        {stage !== "input" && <button onClick={reset} className="text-xs font-semibold text-neutral-500">Start over</button>}
      </header>

      {error && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

      {/* ── 1 · INPUT ── */}
      {stage === "input" && (
        <div className="space-y-3">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
            placeholder="e.g. A warm acoustic guitar with a medium-brown wooden body and a simple modern shape."
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-[15px] outline-none focus:border-neutral-400" />
          <div className="flex items-center gap-2">
            <button onClick={() => fileRef.current?.click()} className="flex-1 rounded-2xl border border-neutral-200 bg-neutral-50 py-3 text-sm font-semibold text-neutral-700">
              {upload ? "✓ Reference added" : "Upload a reference (optional)"}
            </button>
            {upload && <button onClick={() => setUpload(null)} className="rounded-xl px-3 py-3 text-xs text-neutral-500">remove</button>}
          </div>
          {upload && <div style={CHECKER} className="h-40 overflow-hidden rounded-2xl">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={upload} alt="" className="h-full w-full object-contain" /></div>}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      )}

      {(stage === "interpreting") && <Centered>Interpreting your request…</Centered>}

      {/* ── 2/3 · SPEC PREVIEW (review before spending) ── */}
      {stage === "spec" && spec && (
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Interpreted specification</p>
          <input value={spec.name} onChange={(e) => setSpec({ ...spec, name: e.target.value })}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-base font-bold" />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Field k="Class" v={spec.objectClass} />
            <Field k="Role" v={spec.visualRole} />
            <Field k="Materials" v={spec.materials.join(" · ")} />
            <Field k="Interaction" v={spec.interaction} />
            <Field k="Pose" v={spec.canonicalPose} />
            <Field k="Placement" v={spec.placement} />
            <Field k="Surface" v={spec.surface} />
            <Field k="Est. cost" v={`$${spec.estimatedCostUsd.toFixed(2)}`} />
          </div>
          {spec.tags.length > 0 && <p className="text-[11px] text-neutral-500">tags: {spec.tags.join(", ")}</p>}
          <Warn ok={spec.brandNeutral.ok} label="Brand-neutral" note={spec.brandNeutral.note || "generic — no brand"} />
          <Warn ok={spec.moderation.ok} label="Safety" note={spec.moderation.note || "passed"} />
          <label className="block text-[11px] font-semibold text-neutral-500">Generation subject (editable)
            <input value={spec.generationSubject} onChange={(e) => setSpec({ ...spec, generationSubject: e.target.value })}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm font-normal text-neutral-800" />
          </label>
        </div>
      )}

      {stage === "generating" && <Centered><div className="text-center"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-800" />{progress || "Generating…"}</div></Centered>}

      {stage === "publishing" && <Centered><div className="text-center"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-800" />Publishing to your Nestudio library…</div></Centered>}

      {/* ── 5/6 · REVIEW ── */}
      {stage === "review" && result?.finished && spec && (
        <div className="space-y-3">
          <div style={CHECKER} className="aspect-square w-full overflow-hidden rounded-2xl border border-neutral-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}<img src={result.finished.dataUrl} alt={spec.name} className="h-full w-full object-contain" />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold">{spec.name}</span>
            <span className="text-neutral-500">${(result.costUsd ?? 0).toFixed(3)} · {result.pose?.inTolerance ? "pose ✓" : "pose ⚠"}</span>
          </div>
          {!spec.brandNeutral.ok && <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-700">Brand-neutrality: {spec.brandNeutral.note}</div>}

          <button onClick={() => setShowDetails((s) => !s)} className="text-[11px] font-semibold text-neutral-500">{showDetails ? "Hide" : "Details"} (reference · raw · thumbnail · classification)</button>
          {showDetails && (
            <div className="space-y-2 rounded-2xl border border-neutral-100 bg-neutral-50 p-3 text-[11px]">
              <div className="grid grid-cols-3 gap-2">
                <Thumb label="Studio ref" src={referenceUrl} />
                <Thumb label="Raw" src={result.raw?.dataUrl ?? null} checker />
                <Thumb label="Editor size" src={result.finished.dataUrl} checker small />
              </div>
              <p>material: <b>{spec.materials.join(", ")}</b> · pose symmetry: <b>{result.pose?.symmetry?.toFixed(3) ?? "—"}</b> ({result.pose?.inTolerance ? "canonical" : "off-pose"})</p>
              <p>est ${spec.estimatedCostUsd.toFixed(2)} · actual ${(result.costUsd ?? 0).toFixed(3)} · model {result.model}</p>
            </div>
          )}

          <div className="rounded-2xl border border-neutral-200 p-3">
            <p className="mb-2 text-center text-sm font-bold">Would I proudly place this in a Nest?</p>
            <div className="flex gap-2">
              <button onClick={() => setProud(true)} className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${proud === true ? "bg-emerald-600 text-white" : "border border-neutral-200 text-neutral-700"}`}>Yes</button>
              <button onClick={() => setProud(false)} className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${proud === false ? "bg-neutral-800 text-white" : "border border-neutral-200 text-neutral-700"}`}>No</button>
            </div>
            {proud === false && <p className="mt-2 text-center text-[11px] text-neutral-500">Regenerate or edit the request below.</p>}
          </div>
        </div>
      )}

      {/* ── SAVED ── */}
      {stage === "saved" && saved && (
        <div className="space-y-3 text-center">
          <div style={CHECKER} className="mx-auto aspect-square w-2/3 overflow-hidden rounded-2xl border border-neutral-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}<img src={saved.finalDataUrl} alt={saved.name} className="h-full w-full object-contain" />
          </div>
          <p className="text-lg font-black">✓ {saved.name} published</p>
          <p className="text-xs text-neutral-500">Live in the Nestudio library · scope <b>{saved.scope}</b> · id <span className="font-mono">{saved.id}</span></p>
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-700">Saved to Supabase (Storage + catalog). Open the editor and it&apos;s in your Assets tray — it survives reload.</p>
          <button onClick={reset} className="rounded-2xl bg-neutral-900 px-6 py-3 text-sm font-bold text-white">Create another</button>
        </div>
      )}

      {/* ── sticky action bar (one-thumb reachable) ── */}
      <StickyBar>
        {stage === "input" && <Primary onClick={interpret} disabled={!description.trim()}>Interpret →</Primary>}
        {stage === "spec" && spec && (<><Secondary onClick={reset}>Edit</Secondary><Primary onClick={generate} disabled={!spec.moderation.ok}>Generate · ${spec.estimatedCostUsd.toFixed(2)}</Primary></>)}
        {stage === "review" && (<>
          <Secondary onClick={generate}>Regenerate</Secondary>
          <Secondary onClick={() => setStage("spec")}>Edit</Secondary>
          <Primary onClick={approve} disabled={proud !== true}>Approve &amp; Add</Primary>
        </>)}
      </StickyBar>
    </div>
  );
}

/* ── small pieces ── */
function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[40vh] items-center justify-center text-sm text-neutral-500">{children}</div>;
}
function Field({ k, v }: { k: string; v: string }) {
  return <div className="rounded-xl bg-neutral-50 px-3 py-2"><span className="text-[10px] uppercase tracking-wide text-neutral-400">{k}</span><div className="font-semibold text-neutral-800">{v}</div></div>;
}
function Warn({ ok, label, note }: { ok: boolean; label: string; note: string }) {
  return <div className={`rounded-xl px-3 py-2 text-[11px] ${ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}><b>{label}:</b> {ok ? "✓ " : "⚠ "}{note}</div>;
}
function Thumb({ label, src, checker, small }: { label: string; src: string | null; checker?: boolean; small?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-[9px] uppercase tracking-wide text-neutral-400">{label}</p>
      <div style={checker ? CHECKER : { background: "#fff" }} className="aspect-square overflow-hidden rounded-lg border border-neutral-200">
        {src ? <span className="flex h-full w-full items-center justify-center">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={src} alt="" className={small ? "h-1/2 w-1/2 object-contain" : "h-full w-full object-contain"} /></span> : <span className="flex h-full items-center justify-center text-[9px] text-neutral-300">—</span>}
      </div>
    </div>
  );
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
