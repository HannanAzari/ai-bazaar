"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  AVATAR_BUILDS,
  AVATAR_IDENTITY_VERSION,
  STYLE_PRESETS,
  composeAssembly,
  freezeIdentity,
  resolveAvatarBody,
  type AvatarBuild,
  type AvatarIdentity,
  type AvatarStylePreset,
  type FrozenIdentity,
} from "@/lib/avatar-factory/identity";
import { buildAvatarPrompt } from "@/lib/avatar-factory/avatar-dna";
import type { AvatarSpec, StyleIntensity } from "@/lib/avatar-factory/translator";

// ── Founder-only A/B bench ─────────────────────────────────────────────────────
// The ONE question: does a two-stage identity workflow (B) resemble the person more than the
// current one-shot (A)? This is a bench (like /nest-studio/calibration) — it does NOT touch the
// shared GenerationStudio, Asset/Nest studios, the editor, or the home feed. Founder-gated via
// /api/auth/whoami (server truth). Both A and B run from the SAME source photo.

const PRESETS: { key: AvatarStylePreset; label: string }[] = [
  { key: "soft", label: "Soft" },
  { key: "balanced", label: "Balanced" },
  { key: "bold", label: "Bold" },
];
// Same style applied to A (one-shot uses StyleIntensity) and B, so the comparison is fair.
const PRESET_TO_INTENSITY: Record<AvatarStylePreset, StyleIntensity> = { soft: "subtle", balanced: "balanced", bold: "stylised" };

type Step = "upload" | "capturing" | "review-identity" | "profile" | "running" | "compare";
type Verdict = "A" | "B" | "neither" | null;

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json };
}

// Downscale the uploaded photo so both stages get a reasonable, consistent input.
function readAndDownscale(file: File, max = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load the image."));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable."));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// A minimal owned identity for the bench — the approved candidate image is the resemblance
// anchor; the original photo stays as the primary likeness reference in Stage 2.
function candidateIdentity(anchorImageUrl: string): AvatarIdentity {
  return {
    version: AVATAR_IDENTITY_VERSION,
    anchorImageUrl,
    faceShape: "", eyeShape: "", eyebrowShape: "", nose: "", mouth: "", smile: "",
    hairstyle: "", hairColour: "", facialHair: "none", glasses: "none", ears: "", neck: "",
    skinTone: "", distinguishingFeatures: [], expression: "", frozen: false,
  };
}

export function AvatarAbClient() {
  const router = useRouter();
  const [gate, setGate] = useState<"loading" | "denied" | "ready">("loading");
  const [userId, setUserId] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  const [photo, setPhoto] = useState<string | null>(null); // the original photo (WHO)
  const [identityImg, setIdentityImg] = useState<string | null>(null); // Stage-1 candidate
  const [frozen, setFrozen] = useState<FrozenIdentity | null>(null);

  const [build, setBuild] = useState<AvatarBuild>("average");
  const [style, setStyle] = useState<AvatarStylePreset>("balanced");

  const [resultA, setResultA] = useState<string | null>(null); // one-shot
  const [resultB, setResultB] = useState<string | null>(null); // two-stage
  const [costs, setCosts] = useState<{ identity: number | null; a: number | null; b: number | null }>({ identity: null, a: null, b: null });
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [advanced, setAdvanced] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/whoami").then((r) => r.json()).then((d) => {
      if (!alive) return;
      if (!d?.authenticated || !d?.isFounder) { setGate("denied"); return; }
      setUserId(d.userId ?? null);
      setGate("ready");
    }).catch(() => setGate("denied"));
    return () => { alive = false; };
  }, []);

  const onPick = useCallback(async (file?: File) => {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await readAndDownscale(file);
      setPhoto(dataUrl);
      setIdentityImg(null); setFrozen(null); setResultA(null); setResultB(null); setVerdict(null);
      setStep("upload");
    } catch (e) { setError((e as Error).message); }
  }, []);

  // ── Stage 1 · capture identity candidate ──
  const capture = useCallback(async () => {
    if (!photo) return;
    setError(null); setStep("capturing"); setProgress("Capturing your face…");
    const { status, ok, json } = await post("/api/ai/avatar/identity", { imageDataUrl: photo });
    if (status === 401) { setGate("denied"); return; }
    if (!ok || !json.identityDataUrl) { setError(json.error || "Identity capture failed."); setStep("upload"); return; }
    setIdentityImg(json.identityDataUrl as string);
    setCosts((c) => ({ ...c, identity: json.costUsd ?? null }));
    setStep("review-identity");
  }, [photo]);

  // ── Approve → freeze (requires founder approval + owner) ──
  const approveIdentity = useCallback(() => {
    if (!identityImg || !userId) { setError("Missing identity or session."); return; }
    try {
      const f = freezeIdentity(
        candidateIdentity(identityImg),
        { approvedBy: "founder", approvedByUserId: userId, at: new Date().toISOString() },
        { existing: frozen },
      );
      setFrozen(f);
      setStep("profile");
    } catch (e) { setError((e as Error).message); }
  }, [identityImg, userId, frozen]);

  // ── Run BOTH A (one-shot) and B (two-stage) from the same photo/profile/style ──
  const runBoth = useCallback(async () => {
    if (!photo || !frozen || !identityImg) return;
    setError(null); setStep("running"); setResultA(null); setResultB(null); setVerdict(null);

    // B · two-stage: compose from the frozen identity + explicit body + style (dual-reference).
    setProgress("B · assembling your character…");
    const body = resolveAvatarBody(build);
    const assembly = composeAssembly({ identity: frozen, body, style, originalPhotoUrl: photo, approvedIdentityUrl: identityImg });
    const bRes = await post("/api/ai/avatar/assemble", {
      originalPhotoDataUrl: photo,
      identityDataUrl: identityImg,
      positive: assembly.positive,
      negative: assembly.negative,
    });
    if (bRes.status === 401) { setGate("denied"); return; }
    if (bRes.ok && bRes.json.imageDataUrl) { setResultB(bRes.json.imageDataUrl); setCosts((c) => ({ ...c, b: bRes.json.costUsd ?? null })); }
    else setError((prev) => prev || bRes.json.error || "Two-stage (B) failed.");

    // A · one-shot: the current path — translate the photo → spec → single generation.
    setProgress("A · one-shot generation…");
    const tr = await post("/api/ai/avatar/translate", { imageDataUrl: photo });
    if (tr.ok && tr.json.spec) {
      const spec = { ...(tr.json.spec as AvatarSpec), styleIntensity: PRESET_TO_INTENSITY[style], bodyProportionFamily: build };
      const { positive, negative } = buildAvatarPrompt(spec);
      const aRes = await post("/api/ai/avatar/generate", { imageDataUrl: photo, positive, negative });
      if (aRes.ok && aRes.json.imageDataUrl) { setResultA(aRes.json.imageDataUrl); setCosts((c) => ({ ...c, a: aRes.json.costUsd ?? null })); }
      else setError((prev) => prev || aRes.json.error || "One-shot (A) failed.");
    } else setError((prev) => prev || tr.json.error || "One-shot translate failed.");

    setStep("compare");
  }, [photo, frozen, identityImg, build, style]);

  // ── Retry ONLY Stage 2 (B) — reuses the frozen identity, never repeats Stage 1 ──
  const retryB = useCallback(async () => {
    if (!photo || !frozen || !identityImg) return;
    setError(null); setProgress("B · reassembling (identity reused)…");
    const body = resolveAvatarBody(build);
    const assembly = composeAssembly({ identity: frozen, body, style, originalPhotoUrl: photo, approvedIdentityUrl: identityImg });
    const bRes = await post("/api/ai/avatar/assemble", {
      originalPhotoDataUrl: photo, identityDataUrl: identityImg, positive: assembly.positive, negative: assembly.negative,
    });
    if (bRes.ok && bRes.json.imageDataUrl) { setResultB(bRes.json.imageDataUrl); setCosts((c) => ({ ...c, b: bRes.json.costUsd ?? null })); }
    else setError(bRes.json.error || "Two-stage (B) failed.");
    setProgress("");
  }, [photo, frozen, identityImg, build, style]);

  if (gate === "loading") return <Shell><p className="p-8 text-center text-sm text-neutral-500">Loading…</p></Shell>;
  if (gate === "denied") return <Shell><p className="p-8 text-center text-sm text-neutral-500">Founder access required.</p></Shell>;

  const totalSpend = (costs.identity ?? 0) + (costs.a ?? 0) + (costs.b ?? 0);

  return (
    <Shell>
      <header className="mb-4 flex items-center gap-2">
        <button onClick={() => router.push("/profile")} aria-label="Back" className="flex size-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"><ArrowLeft size={20} /></button>
        <div>
          <h1 className="text-lg font-black tracking-tight">Avatar Identity · A/B</h1>
          <p className="text-[11px] text-neutral-500">One-shot (A) vs Identity Capture → Assembly (B) · {AVATAR_IDENTITY_VERSION}</p>
        </div>
      </header>

      {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>}

      {/* Step: upload */}
      {(step === "upload" || step === "capturing") && (
        <div className="space-y-3">
          <button onClick={() => fileRef.current?.click()} className="grid aspect-[3/4] w-full place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 text-neutral-500">
            {photo ? <img src={photo} alt="source" className="h-full w-full object-cover" /> /* eslint-disable-line @next/next/no-img-element */ : <span className="text-sm">Tap to choose a photo</span>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
          {photo && step === "upload" && <button onClick={capture} className="w-full rounded-2xl bg-neutral-900 py-3 text-sm font-bold text-white">Capture identity (Stage 1)</button>}
          {step === "capturing" && <p className="text-center text-sm text-neutral-500">{progress}</p>}
        </div>
      )}

      {/* Step: review identity — "Does this look like you?" */}
      {step === "review-identity" && identityImg && (
        <div className="space-y-3">
          <p className="text-center text-sm font-bold text-neutral-800">Does this look like you?</p>
          <div className="grid grid-cols-2 gap-2">
            <Framed label="Your photo" src={photo} />
            <Framed label="Identity candidate" src={identityImg} checker />
          </div>
          <div className="grid grid-cols-1 gap-2">
            <button onClick={approveIdentity} className="w-full rounded-2xl bg-neutral-900 py-3 text-sm font-bold text-white">Yes, use this identity</button>
            <button onClick={capture} className="w-full rounded-2xl border border-neutral-300 py-3 text-sm font-semibold text-neutral-700">Try again</button>
            <button onClick={() => { setFrozen(null); setBuild("average"); setStyle("balanced"); setStep("profile"); }} className="w-full rounded-2xl border border-neutral-200 py-2.5 text-[12px] text-neutral-500">Use the original one-shot flow only</button>
          </div>
        </div>
      )}

      {/* Step: body profile + style, then run */}
      {step === "profile" && (
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-neutral-600">Body profile <span className="font-normal text-neutral-400">(chosen — never guessed from a headshot)</span></p>
            <div className="flex flex-wrap gap-2">
              {AVATAR_BUILDS.map((b) => (
                <button key={b} onClick={() => setBuild(b)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold capitalize ${build === b ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600"}`}>{b}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-neutral-600">Style (presentation only)</p>
            <div className="flex gap-2">
              {PRESETS.map((p) => (
                <button key={p.key} onClick={() => setStyle(p.key)} className={`flex-1 rounded-2xl px-3 py-2 text-[13px] font-semibold ${style === p.key ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600"}`}>{p.label}</button>
              ))}
            </div>
          </div>
          <button onClick={runBoth} disabled={!frozen} className="w-full rounded-2xl bg-neutral-900 py-3 text-sm font-bold text-white disabled:opacity-40">
            {frozen ? "Run A vs B" : "Approve an identity first"}
          </button>
          {!frozen && <p className="text-center text-[11px] text-neutral-400">The two-stage path (B) needs an approved identity. Go back to capture one.</p>}
        </div>
      )}

      {step === "running" && <p className="py-10 text-center text-sm text-neutral-500">{progress}</p>}

      {/* Step: compare A vs B */}
      {step === "compare" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Framed label="Your photo" src={photo} />
            <Framed label="Approved identity" src={identityImg} checker />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 text-center text-[11px] font-bold uppercase tracking-wide text-neutral-500">A · one-shot</p>
              <Framed src={resultA} checker tall />
            </div>
            <div>
              <p className="mb-1 text-center text-[11px] font-bold uppercase tracking-wide text-neutral-500">B · two-stage</p>
              <Framed src={resultB} checker tall />
              {resultB && <button onClick={retryB} className="mt-1 w-full rounded-xl border border-neutral-300 py-1.5 text-[11px] font-semibold text-neutral-600">Retry B (reuse identity)</button>}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-3">
            <p className="mb-2 text-center text-[12px] font-bold text-neutral-700">Which resembles the person more?</p>
            <div className="grid grid-cols-3 gap-2">
              {(["A", "B", "neither"] as const).map((v) => (
                <button key={v} onClick={() => setVerdict(v)} className={`rounded-xl py-2 text-[12px] font-bold capitalize ${verdict === v ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600"}`}>{v === "neither" ? "Neither" : v}</button>
              ))}
            </div>
            {verdict && <p className="mt-2 text-center text-[12px] text-neutral-600">Recorded: <b>{verdict === "neither" ? "Neither is good enough" : `${verdict} resembles more`}</b></p>}
          </div>

          <button onClick={() => setAdvanced((a) => !a)} className="w-full text-center text-[11px] text-neutral-400">{advanced ? "Hide" : "Founder advanced"}</button>
          {advanced && (
            <div className="space-y-1 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-[11px] text-neutral-500">
              <p>identity version · {frozen?.version ?? "—"} · frozen {String(!!frozen?.frozen)}</p>
              <p>original photo ref · {photo ? "present" : "missing"} · approved ref · {identityImg ? "present" : "missing"}</p>
              <p>body profile · {build} · style · {style} · pose · idle-standing</p>
              <p>cost — identity ${(costs.identity ?? 0).toFixed(3)} · A ${(costs.a ?? 0).toFixed(3)} · B ${(costs.b ?? 0).toFixed(3)} · total ${totalSpend.toFixed(3)}</p>
              <p>style posture (B) · {STYLE_PRESETS[style].posture}</p>
            </div>
          )}

          <button onClick={() => { setStep("upload"); setPhoto(null); setIdentityImg(null); setFrozen(null); setResultA(null); setResultB(null); setVerdict(null); }} className="w-full rounded-2xl border border-neutral-200 py-2.5 text-[12px] text-neutral-500">Start over</button>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-white px-4 text-neutral-900" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))", paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>
      {children}
    </div>
  );
}

function Framed({ label, src, checker, tall }: { label?: string; src: string | null; checker?: boolean; tall?: boolean }) {
  return (
    <div>
      {label && <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-400">{label}</p>}
      <div className={`grid ${tall ? "aspect-[3/4]" : "aspect-square"} place-items-center overflow-hidden rounded-xl border border-neutral-200`} style={checker ? CHECKER : undefined}>
        {src ? <img src={src} alt={label || ""} className="h-full w-full object-contain" /> /* eslint-disable-line @next/next/no-img-element */ : <span className="text-[11px] text-neutral-400">—</span>}
      </div>
    </div>
  );
}

const CHECKER: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
};
