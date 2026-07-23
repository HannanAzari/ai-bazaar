"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { founderHeaders } from "@/lib/founder-token";
import { CHECKER, Centered, Primary, Secondary, Spinner, StickyBar } from "@/components/generation/ui";
import { FOUNDER_OWNERSHIP, type GenerationModule, type SavedInfo } from "@/lib/generation-platform/types";

// ── The one Generation Studio ─────────────────────────────────────────────────
//
// Owns EVERYTHING shared across generation modules: auth handling (401→sign-in,
// 403→founder-only), the input→interpret→spec→generate→review→approve→publish→saved
// stage machine, the re-entrancy (double-tap) guard, cost display, moderation gating,
// upload, back navigation, and the sticky one-thumb action bar. A module plugs in its
// translator, engine, publish call, and the type-specific screens.
//
// Access is enforced SERVER-SIDE per module: founder modules (Asset/Nest) require a
// signed-in founder/admin (requireFounder); the avatar module requires any signed-in
// user (requireUser). No client-side founder-code screen — the server is the gate.

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
  // optionalReview (Avatar): questions are soft feedback and Approve is always enabled.
  const canApprove = module.copy.optionalReview ? true : (answers.length === questions.length && answers.every((a) => a === true));
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [saved, setSaved] = useState<SavedInfo | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname() ?? module.copy.backHref;

  // One in-flight expensive action at a time (double-tap / re-entrancy guard).
  const busy = useRef(false);

  const reset = () => { setStage("input"); setSpec(null); setResult(null); setAnswers(questions.map(() => null)); setError(null); setProgress(""); setSaved(null); setExtraReady(false); busy.current = false; };
  const setAnswer = (i: number, v: boolean) => setAnswers((prev) => prev.map((a, idx) => (idx === i ? v : a)));

  // Uniform auth handling: 401 → send to login and return here; 403 → founder-only message.
  const handleAuth = (r: { unauthorized?: boolean; forbidden?: boolean; error: string }) => {
    if (r.unauthorized) { setError("Please sign in to continue."); router.push(`/auth/login?next=${encodeURIComponent(pathname)}`); }
    else if (r.forbidden) setError(r.error || "This studio is for founders only.");
    else setError(r.error);
  };

  // Back navigation with safe fallback + guards against losing work.
  const leave = () => {
    if ((stage === "generating" || stage === "publishing") && !window.confirm("Generation is in progress. Leave anyway?")) return;
    const hasDraft = stage === "spec" || stage === "review" || (stage === "input" && Boolean(upload || description.trim()));
    if (hasDraft && !window.confirm("Leave the studio? Your current draft will be discarded.")) return;
    router.push(module.copy.backHref);
  };

  // "Taking longer than expected" affordance — after 30s in a long stage, offer a way out
  // (the module's own timeouts still guarantee the promise settles; this is a UI escape hatch).
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (stage !== "generating" && stage !== "publishing") { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 30_000);
    return () => clearTimeout(t);
  }, [stage]);
  const cancelSlow = () => { busy.current = false; setSlow(false); setError("Cancelled. No completed charge — you can try again."); setStage(stage === "publishing" ? "review" : "spec"); };

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
    if (!out.ok) { handleAuth(out); setStage("input"); return; }
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
    if (!out.ok) { handleAuth(out); setStage("spec"); return; }
    setResult(out.value); setStage("review");
  }, [spec, upload, module]);

  /* 7: approve → publish through the module, mirror locally, then Saved. */
  const approve = useCallback(async () => {
    if (!spec || !result || !canApprove || busy.current) return;
    busy.current = true;
    setError(null); setStage("publishing");
    const outcome = await module.publish({ spec, result, upload, ownership: FOUNDER_OWNERSHIP });
    module.onApproved?.({ spec, result, outcome, ownership: FOUNDER_OWNERSHIP });
    busy.current = false;
    if (!outcome.ok) {
      if (outcome.unauthorized || outcome.forbidden) { handleAuth(outcome); setStage("review"); return; }
      setError(`Publish failed: ${outcome.error}. You can retry Approve.`);
      setStage("review"); // return to review so Approve can be retried
      return;
    }
    setSaved({ name: module.specName(spec), id: outcome.id, imageDataUrl: module.resultImage(result), published: true });
    setStage("saved");
  }, [spec, result, canApprove, module]);

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

  return (
    <div
      className="mx-auto min-h-screen w-full max-w-md bg-white px-4 text-neutral-900"
      style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))", paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}
    >
      <header className="mb-4 flex items-center gap-2">
        <button onClick={leave} aria-label="Back" className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-black tracking-tight">{copy.headerTitle}</h1>
          <p className="truncate text-[11px] text-neutral-500">{copy.headerTagline}</p>
        </div>
        {stage !== "input" && <button onClick={reset} className="shrink-0 text-xs font-semibold text-neutral-500">Start over</button>}
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

      {(stage === "generating" || stage === "publishing") && (
        <div>
          <Spinner>{stage === "publishing" ? copy.publishingLabel : (progress || "Generating…")}</Spinner>
          {slow && (
            <div className="mx-auto max-w-xs rounded-2xl border border-amber-200 bg-amber-50 p-3 text-center text-[12px] text-amber-800">
              Taking longer than expected.
              <div className="mt-2 flex justify-center gap-2">
                <button onClick={() => setSlow(false)} className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-800">Keep waiting</button>
                <button onClick={cancelSlow} className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white">Cancel safely</button>
              </div>
            </div>
          )}
        </div>
      )}

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
          <Secondary onClick={generate}>{copy.regenerateLabel ?? "Regenerate"}</Secondary>
          <Secondary onClick={() => setStage("spec")}>{copy.editLabel ?? "Edit"}</Secondary>
          <Primary onClick={approve} disabled={!canApprove}>{copy.approveLabel}</Primary>
        </>)}
      </StickyBar>
    </div>
  );
}
