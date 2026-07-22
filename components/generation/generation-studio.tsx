"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clearFounderToken, founderHeaders, hasFounderToken, setFounderToken } from "@/lib/founder-token";
import { CHECKER, Centered, Primary, Secondary, Spinner, StickyBar } from "@/components/generation/ui";
import { FOUNDER_OWNERSHIP, type GenerationModule, type SavedInfo } from "@/lib/generation-platform/types";

// ── The one Generation Studio ─────────────────────────────────────────────────
//
// Owns EVERYTHING shared across generation modules: the founder gate + token, the
// input→interpret→spec→generate→review→approve→publish→saved stage machine, the
// re-entrancy (double-tap) guard, uniform 401 handling, cost display, moderation
// gating, upload capability, and the sticky one-thumb action bar. A module plugs in
// its translator, engine, publish call, and the three type-specific screens.
//
// Asset Factory and Nest Factory are now `<GenerationStudio module={…} />`.

const MODERATION_BLOCKED = "This request was flagged by moderation and cannot be generated.";

type Stage = "input" | "interpreting" | "spec" | "generating" | "review" | "publishing" | "saved";

export function GenerationStudio<Spec, Result>({ module }: { module: GenerationModule<Spec, Result> }) {
  const [stage, setStage] = useState<Stage>("input");
  const [description, setDescription] = useState("");
  const [upload, setUpload] = useState<string | null>(null);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const questions = module.copy.reviewQuestions ?? [module.copy.reviewQuestion];
  const [answers, setAnswers] = useState<(boolean | null)[]>(() => questions.map(() => null));
  const allYes = answers.length === questions.length && answers.every((a) => a === true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [saved, setSaved] = useState<SavedInfo | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Founder gate — assume authed on the server, correct on mount.
  const [authed, setAuthed] = useState(true);
  const [tokenInput, setTokenInput] = useState("");
  useEffect(() => { setAuthed(hasFounderToken()); }, []);

  // One in-flight expensive action at a time (double-tap / re-entrancy guard).
  const busy = useRef(false);

  const reset = () => { setStage("input"); setSpec(null); setResult(null); setAnswers(questions.map(() => null)); setError(null); setProgress(""); setSaved(null); setExtraReady(false); busy.current = false; };
  const setAnswer = (i: number, v: boolean) => setAnswers((prev) => prev.map((a, idx) => (idx === i ? v : a)));
  const saveToken = () => { const t = tokenInput.trim(); if (!t) return; setFounderToken(t); setAuthed(true); setTokenInput(""); setError(null); };
  const userMode = module.authMode === "user";
  const onAuthError = () => { clearFounderToken(); setAuthed(false); setError("Founder access expired or invalid — re-enter your access code."); };
  // 401 handling depends on auth mode: user modules show a sign-in prompt (no founder gate).
  const handleUnauthorized = () => { if (userMode) setError("Please sign in to continue — your session may have expired."); else onAuthError(); };

  const [extraReady, setExtraReady] = useState(false);
  const uploadRequiredMissing = module.uploadMode === "required" && !upload;
  // Image-first modules (Avatar) are driven by the upload; text-first modules by the prompt.
  const baseInput = module.uploadMode === "required" ? Boolean(upload) : Boolean(description.trim());
  const canInterpret = baseInput && (!module.InputExtra || extraReady);

  /* 1 → 2: interpret the request into a spec. */
  const interpret = useCallback(async () => {
    if (!canInterpret || busy.current) return;
    busy.current = true;
    setError(null); setStage("interpreting");
    const out = await module.translate({ description: description.trim(), upload, hasReference: !!upload, headers: founderHeaders() });
    busy.current = false;
    if (!out.ok) { if (out.unauthorized) handleUnauthorized(); else setError(out.error); setStage("input"); return; }
    setSpec(out.value); setStage("spec");
  }, [canInterpret, description, upload, module]);

  /* 4: generate one candidate through the module's engine. */
  const generate = useCallback(async () => {
    if (!spec || busy.current) return;
    if (!module.moderationOk(spec)) { setError(MODERATION_BLOCKED); return; }
    busy.current = true;
    setError(null); setStage("generating"); setResult(null); setAnswers(questions.map(() => null)); setProgress("");
    const out = await module.generate({ spec, upload, setProgress, headers: founderHeaders() });
    busy.current = false;
    if (!out.ok) { if (out.unauthorized) handleUnauthorized(); else setError(out.error); setStage("spec"); return; }
    setResult(out.value); setStage("review");
  }, [spec, upload, module]);

  /* 7: approve → publish through the module, mirror locally, then Saved. */
  const approve = useCallback(async () => {
    if (!spec || !result || !allYes || busy.current) return;
    busy.current = true;
    setError(null); setStage("publishing");
    const outcome = await module.publish({ spec, result, upload, ownership: FOUNDER_OWNERSHIP });
    module.onApproved?.({ spec, result, outcome, ownership: FOUNDER_OWNERSHIP });
    busy.current = false;
    if (!outcome.ok) {
      if (outcome.unauthorized) { handleUnauthorized(); setStage("review"); return; }
      setError(`Publish failed: ${outcome.error}. You can retry Approve.`);
      setStage("review"); // return to review so Approve can be retried
      return;
    }
    setSaved({ name: module.specName(spec), id: outcome.id, imageDataUrl: module.resultImage(result), published: true });
    setStage("saved");
  }, [spec, result, allYes, module]);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setUpload(r.result as string);
    r.readAsDataURL(f);
  };

  const { copy } = module;
  const SpecView = module.SpecView;
  const ReviewView = module.ReviewView;
  const DetailsView = module.DetailsView;
  const SavedView = module.SavedView;

  // ── Founder gate screen (founder-auth modules only; user modules auth via the server) ──
  if (!authed && !userMode) {
    return (
      <div
        className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-white px-6 text-neutral-900"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <h1 className="text-xl font-black tracking-tight">{copy.gateTitle}</h1>
        <p className="mt-1 text-sm text-neutral-500">{copy.gateSubtitle}</p>
        {error && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
        <input
          type="password" inputMode="text" autoComplete="off" value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") saveToken(); }}
          placeholder="Founder access code"
          className="mt-4 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-base outline-none focus:border-neutral-400"
        />
        <button onClick={saveToken} disabled={!tokenInput.trim()} className="mt-3 w-full rounded-2xl bg-neutral-900 py-3.5 text-sm font-bold text-white disabled:opacity-30">{copy.gateButton}</button>
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
          <h1 className="text-lg font-black tracking-tight">{copy.headerTitle}</h1>
          <p className="text-[11px] text-neutral-500">{copy.headerTagline}</p>
        </div>
        {stage !== "input" && <button onClick={reset} className="text-xs font-semibold text-neutral-500">Start over</button>}
      </header>

      {error && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

      {/* 1 · INPUT */}
      {stage === "input" && (
        <div className="space-y-3">
          {module.InputExtra && <module.InputExtra onReadyChange={setExtraReady} />}
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={module.uploadMode === "required" ? 2 : 4}
            placeholder={copy.inputPlaceholder}
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-[15px] outline-none focus:border-neutral-400" />
          {module.uploadMode !== "none" && (
            <>
              <div className="flex items-center gap-2">
                <button onClick={() => fileRef.current?.click()} className="flex-1 rounded-2xl border border-neutral-200 bg-neutral-50 py-3 text-sm font-semibold text-neutral-700">
                  {upload ? "✓ Reference added" : module.uploadMode === "required" ? "Upload a photo" : "Upload a reference (optional)"}
                </button>
                {upload && <button onClick={() => setUpload(null)} className="rounded-xl px-3 py-3 text-xs text-neutral-500">remove</button>}
              </div>
              {upload && <div style={CHECKER} className="h-40 overflow-hidden rounded-2xl">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={upload} alt="" className="h-full w-full object-contain" /></div>}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
            </>
          )}
          {copy.inputHint && <p className="text-[11px] text-neutral-500">{copy.inputHint}</p>}
        </div>
      )}

      {stage === "interpreting" && <Centered>Interpreting…</Centered>}

      {/* 2/3 · SPEC */}
      {stage === "spec" && spec && (
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Interpreted specification</p>
          <SpecView spec={spec} onChange={setSpec} />
        </div>
      )}

      {stage === "generating" && <Spinner>{progress || "Generating…"}</Spinner>}
      {stage === "publishing" && <Spinner>{copy.publishingLabel}</Spinner>}

      {/* 5/6 · REVIEW */}
      {stage === "review" && result && spec && (
        <div className="space-y-3">
          <ReviewView spec={spec} result={result} upload={upload} />
          {DetailsView && copy.detailsLabel && (
            <>
              <button onClick={() => setShowDetails((s) => !s)} className="text-[11px] font-semibold text-neutral-500">{showDetails ? "Hide" : "Details"} {copy.detailsLabel}</button>
              {showDetails && <DetailsView spec={spec} result={result} upload={upload} />}
            </>
          )}
          <div className="space-y-2 rounded-2xl border border-neutral-200 p-3">
            {questions.map((q, i) => (
              <div key={i}>
                <p className="mb-2 text-center text-sm font-bold">{q}</p>
                <div className="flex gap-2">
                  <button onClick={() => setAnswer(i, true)} className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${answers[i] === true ? "bg-emerald-600 text-white" : "border border-neutral-200 text-neutral-700"}`}>Yes</button>
                  <button onClick={() => setAnswer(i, false)} className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${answers[i] === false ? "bg-neutral-800 text-white" : "border border-neutral-200 text-neutral-700"}`}>No</button>
                </div>
              </div>
            ))}
            {answers.some((a) => a === false) && <p className="mt-1 text-center text-[11px] text-neutral-500">Regenerate or edit below.</p>}
          </div>
        </div>
      )}

      {/* SAVED */}
      {stage === "saved" && saved && (
        <div className="space-y-3 text-center">
          <SavedView info={saved} />
          <button onClick={reset} className="rounded-2xl bg-neutral-900 px-6 py-3 text-sm font-bold text-white">Create another</button>
        </div>
      )}

      {/* sticky action bar */}
      <StickyBar>
        {stage === "input" && <Primary onClick={interpret} disabled={!canInterpret}>Interpret →</Primary>}
        {stage === "spec" && spec && (<><Secondary onClick={reset}>Edit</Secondary><Primary onClick={generate} disabled={!module.moderationOk(spec)}>Generate · ${module.estimatedCost(spec).toFixed(2)}</Primary></>)}
        {stage === "review" && (<>
          <Secondary onClick={generate}>Regenerate</Secondary>
          <Secondary onClick={() => setStage("spec")}>Edit</Secondary>
          <Primary onClick={approve} disabled={!allYes}>{copy.approveLabel}</Primary>
        </>)}
      </StickyBar>
    </div>
  );
}
