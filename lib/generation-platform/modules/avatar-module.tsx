"use client";

import { useEffect, useState } from "react";
import { Feather, Flame, Sparkles } from "lucide-react";
import { buildAvatarPrompt, scoreAvatarDna } from "@/lib/avatar-factory/avatar-dna";
import { AVATAR_REFERENCE_COST, type AvatarSpec } from "@/lib/avatar-factory/translator";
import { CHECKER, Warn } from "@/components/generation/ui";
import type { GenerationModule } from "@/lib/generation-platform/types";

// Avatar module — the FIRST user-owned generation type on the shared platform. It plugs
// in with NO shell code: the Studio owns the stage machine, upload, review, approve,
// progress, cost, error recovery, mobile layout. Avatar supplies only its engine + screens
// + consent. Auth is real user auth (authMode:"user"); publish is private-user (server-enforced).

export type AvatarResult = { imageDataUrl: string; costUsd: number | null };

// Same-origin fetches send the Supabase session cookie automatically → the routes
// authenticate the real user via requireUser(). No founder token is used.
async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json };
}

function ConsentGate({ onReadyChange }: { onReadyChange: (ready: boolean) => void }) {
  const [c, setC] = useState([false, false, false]);
  const set = (i: number, v: boolean) => { const next = c.map((x, idx) => (idx === i ? v : x)); setC(next); onReadyChange(next.every(Boolean)); };
  const items = [
    "I have permission to use this image.",
    "I understand it will be processed to create an avatar.",
    "I can delete the source photo and the generated result.",
  ];
  return (
    <div className="space-y-2 rounded-2xl border border-timber/15 bg-parchment/40 p-3">
      <p className="text-[13px] font-semibold text-ink">Use a clear photo of yourself, or a person who has given you permission.</p>
      {items.map((label, i) => (
        <label key={i} className="flex items-start gap-2 text-[12px] text-ink/70">
          <input type="checkbox" checked={c[i]} onChange={(e) => set(i, e.target.checked)} className="mt-0.5 h-4 w-4" />
          <span>{label}</span>
        </label>
      ))}
      <p className="text-[11px] text-ink/45">Your photo stays private. It is never shown publicly and can be deleted at any time.</p>
    </div>
  );
}

export const avatarModule: GenerationModule<AvatarSpec, AvatarResult> = {
  key: "avatar",
  uploadMode: "required",
  authMode: "user",
  copy: {
    headerTitle: "Your Avatar",
    headerTagline: "Your digital self, made from a photo.",
    gateTitle: "Your Avatar",
    gateSubtitle: "Sign in required.",
    gateButton: "Continue",
    inputPlaceholder: "Optional — a word about your style (glasses, smart-casual)…",
    inputHint: "Private to you. We keep your face, hair and details.",
    publishingLabel: "Saving your avatar…",
    approveLabel: "Use avatar",
    regenerateLabel: "Try again",
    editLabel: "Adjust style",
    interpretLabel: "Continue",
    generateLabel: "Create Avatar",
    reviewQuestion: "",
    reviewQuestions: [], // clean reveal — primary actions only (Part 6)
    optionalReview: true,
    detailsLabel: "(details)",
    backHref: "/profile",
  },

  async translate({ upload }) {
    if (!upload) return { ok: false, error: "A photo is required." };
    const { status, ok, json } = await post("/api/ai/avatar/translate", { imageDataUrl: upload });
    if (status === 401) return { ok: false, error: "", unauthorized: true };
    if (status === 403) return { ok: false, error: json.error || "Not allowed.", forbidden: true };
    if (!ok || !json.spec) return { ok: false, error: json.error || "Could not read the photo." };
    return { ok: true, value: json.spec as AvatarSpec };
  },

  estimatedCost: (spec) => spec.estimatedCostUsd,
  moderationOk: (spec) => spec.moderation.ok,
  specName: (spec) => spec.displayName,

  async generate({ spec, upload, setProgress }) {
    if (!upload) return { ok: false, error: "A photo is required." };
    // Anticipation, not a progress bar — warm phrases describing the real creation while it runs.
    const stages = ["Finding your features", "Creating your character", "Adding the final details", "Almost ready"];
    let i = 0;
    setProgress(stages[0]);
    const timer = setInterval(() => { i = Math.min(i + 1, stages.length - 1); setProgress(stages[i]); }, 8000);
    try {
      const { positive, negative } = buildAvatarPrompt(spec);
      const { status, ok, json } = await post("/api/ai/avatar/generate", { imageDataUrl: upload, positive, negative });
      if (status === 401) return { ok: false, error: "", unauthorized: true };
      if (status === 403) return { ok: false, error: json.error || "Not allowed.", forbidden: true };
      if (!ok || !json.imageDataUrl) return { ok: false, error: json.error || "We couldn't create your avatar. Please try again." };
      return { ok: true, value: { imageDataUrl: json.imageDataUrl as string, costUsd: json.costUsd ?? null } };
    } finally { clearInterval(timer); }
  },

  resultImage: (r) => r.imageDataUrl,
  resultCost: (r) => r.costUsd,

  async publish({ spec, result, upload }) {
    const { status, ok, json } = await post("/api/avatar/publish", {
      displayName: spec.displayName,
      sourceDataUrl: upload,
      outputDataUrl: result.imageDataUrl,
      pose: spec.canonicalPose,
      styleVersion: "avatar-dna-v1",
      metadata: { styleIntensity: spec.styleIntensity, outfitCategory: spec.outfitCategory, intendedUses: spec.intendedUses, privacyScope: spec.privacyScope },
      cost: { reference: AVATAR_REFERENCE_COST, generation: result.costUsd, total: (result.costUsd ?? 0) + AVATAR_REFERENCE_COST },
      active: true,
    });
    if (status === 401) return { ok: false, error: "", unauthorized: true };
    if (status === 403) return { ok: false, error: json.error || "Not allowed.", forbidden: true };
    if (!ok) return { ok: false, error: json.error || `Publish failed (HTTP ${status}).` };
    return { ok: true, id: json.id, imageUrl: json.publicProfileUrl ?? "", status: json.active ? "active" : "saved" };
  },

  InputExtra: ConsentGate,

  // Choosing a style should feel creative — large inspiration cards, not settings (Part 7).
  SpecView({ spec, onChange }) {
    const styles: { key: AvatarSpec["styleIntensity"]; label: string; line: string; icon: typeof Feather }[] = [
      { key: "subtle", label: "Soft", line: "Gentle and true to life", icon: Feather },
      { key: "balanced", label: "Balanced", line: "Warm, polished — unmistakably you", icon: Sparkles },
      { key: "stylised", label: "Bold", line: "More character, more flair", icon: Flame },
    ];
    return (
      <div className="space-y-4">
        <div>
          <p className="mb-1 text-center text-sm font-black text-ink">Choose your look</p>
          <div className="space-y-2">
            {styles.map(({ key, label, line, icon: Icon }) => {
              const on = spec.styleIntensity === key;
              return (
                <button key={key} onClick={() => onChange({ ...spec, styleIntensity: key })}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99] ${on ? "border-terracotta bg-terracotta/8 shadow-soft" : "border-timber/15 bg-white"}`}>
                  <span className={`grid size-11 shrink-0 place-items-center rounded-full ${on ? "bg-terracotta text-parchment" : "bg-parchment text-terracotta"}`}><Icon size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-black text-ink">{label}</span>
                    <span className="block text-[12px] text-ink/50">{line}</span>
                  </span>
                  <span className={`size-5 shrink-0 rounded-full border-2 ${on ? "border-terracotta bg-terracotta" : "border-timber/25"}`} />
                </button>
              );
            })}
          </div>
        </div>
        <input value={spec.displayName} onChange={(e) => onChange({ ...spec, displayName: e.target.value })}
          placeholder="Name your avatar"
          className="w-full rounded-2xl border border-timber/20 bg-parchment/40 px-4 py-3 text-center text-[15px] font-bold text-ink outline-none focus:border-terracotta/50" />
        {!spec.moderation.ok && <Warn ok={false} label="Please try another photo" note={spec.moderation.note || ""} />}
      </div>
    );
  },

  // The reveal: the avatar dominates and eases in (Part 5/6). Everything else is secondary.
  ReviewView({ spec, result }) {
    return (
      <div className="space-y-3">
        <AvatarReveal src={result.imageDataUrl} alt={spec.displayName} />
        <p className="text-center text-xl font-black text-ink">{spec.displayName}</p>
      </div>
    );
  },

  // Founder-only details behind the toggle (resemblance + checks + cost).
  DetailsView({ spec, result, upload }) {
    const dna = scoreAvatarDna(spec);
    return (
      <div className="space-y-2 rounded-2xl border border-timber/10 bg-parchment/40 p-3 text-[11px] text-ink/60">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="mb-1 text-[9px] uppercase tracking-wide text-ink/40">Your photo</p><div className="aspect-square overflow-hidden rounded-lg border border-timber/15 bg-white">{upload ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={upload} alt="" className="h-full w-full object-cover" /> : null}</div></div>
          <div><p className="mb-1 text-[9px] uppercase tracking-wide text-ink/40">Face</p><div className="aspect-square overflow-hidden rounded-lg border border-timber/15 bg-white">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={result.imageDataUrl} alt="" className="w-full" style={{ transform: "scale(3)", transformOrigin: "top center" }} /></div></div>
        </div>
        <div className="grid grid-cols-2 gap-1 pt-1">{dna.checks.map((c) => <p key={c.label}>{c.ok ? "✓" : "⚠"} {c.label}</p>)}</div>
        <p>camera {spec.canonicalPose} · transparent · privacy {spec.privacyScope} · gen ${(result.costUsd ?? 0).toFixed(3)}</p>
      </div>
    );
  },

  SavedView({ info }) {
    return (
      <>
        <div style={CHECKER} className="mx-auto w-2/3 overflow-hidden rounded-3xl border border-timber/15 shadow-lift">
          {/* eslint-disable-next-line @next/next/no-img-element */}<img src={info.imageDataUrl} alt={info.name} className="h-full w-full object-contain" />
        </div>
        <p className="text-xl font-black text-ink">Your avatar is ready</p>
        <p className="text-sm text-ink/55">It&apos;s on your profile now — private to you, delete it any time.</p>
      </>
    );
  },
};

// The reveal — a soft fade + scale-in with a gentle shadow. Elegant, no gimmicks (Part 5).
function AvatarReveal({ src, alt }: { src: string; alt: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 60); return () => clearTimeout(t); }, []);
  return (
    <div
      style={CHECKER}
      className={`mx-auto w-4/5 overflow-hidden rounded-3xl border border-timber/15 transition-all duration-700 ease-out ${shown ? "scale-100 opacity-100 shadow-lift" : "scale-95 opacity-0 shadow-none"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="mx-auto h-80 w-full object-contain" />
    </div>
  );
}
