"use client";

import { useState } from "react";
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
    headerTitle: "Avatar Studio",
    headerTagline: "Turn a photo into your Nestudio identity.",
    gateTitle: "Avatar Studio",
    gateSubtitle: "Sign in required.",
    gateButton: "Continue",
    inputPlaceholder: "Optional: note a styling preference (e.g. smart-casual, glasses).",
    inputHint: "Full-body avatar, private to you. Idle standing pose.",
    publishingLabel: "Saving your avatar privately…",
    approveLabel: "Use this avatar",
    regenerateLabel: "Try again",
    editLabel: "Adjust style",
    reviewQuestion: "Does this look like you?",
    reviewQuestions: ["Does this look like you?"],
    optionalReview: true, // soft feedback — Use this avatar is always available
    detailsLabel: "(generation details)",
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
    setProgress("Sculpting your avatar");
    const { positive, negative } = buildAvatarPrompt(spec);
    const { status, ok, json } = await post("/api/ai/avatar/generate", { imageDataUrl: upload, positive, negative });
    if (status === 401) return { ok: false, error: "", unauthorized: true };
    if (status === 403) return { ok: false, error: json.error || "Not allowed.", forbidden: true };
    if (!ok || !json.imageDataUrl) return { ok: false, error: json.error || "Avatar generation failed." };
    return { ok: true, value: { imageDataUrl: json.imageDataUrl as string, costUsd: json.costUsd ?? null } };
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

  // Simple, human spec screen — pick a style; no engineering fields.
  SpecView({ spec, onChange }) {
    const styles: { key: AvatarSpec["styleIntensity"]; label: string }[] = [
      { key: "subtle", label: "Softer" },
      { key: "balanced", label: "Balanced" },
      { key: "stylised", label: "Bolder" },
    ];
    return (
      <>
        <label className="block text-[11px] font-semibold text-ink/50">Avatar name
          <input value={spec.displayName} onChange={(e) => onChange({ ...spec, displayName: e.target.value })}
            className="mt-1 w-full rounded-xl border border-timber/20 px-3 py-2 text-base font-bold text-ink" />
        </label>
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-ink/50">Style</p>
          <div className="flex gap-2">
            {styles.map((s) => (
              <button key={s.key} onClick={() => onChange({ ...spec, styleIntensity: s.key })}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${spec.styleIntensity === s.key ? "bg-terracotta text-parchment shadow-soft" : "border border-timber/20 bg-white text-ink/70"}`}>{s.label}</button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-ink/50">We&apos;ll keep your face, hair and accessories. Your photo stays private.</p>
        {!spec.moderation.ok && <Warn ok={false} label="Safety" note={spec.moderation.note || "flagged"} />}
      </>
    );
  },

  // Review leads with the avatar (Part 6): big avatar → resemblance (your photo + face) → actions.
  ReviewView({ spec, result, upload }) {
    return (
      <>
        <p className="text-center text-lg font-black text-ink">{spec.displayName}</p>
        {/* 1 · the avatar, large, on transparency */}
        <div style={CHECKER} className="mx-auto w-3/4 overflow-hidden rounded-2xl border border-neutral-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.imageDataUrl} alt={spec.displayName} className="mx-auto h-72 w-full object-contain" />
        </div>
        {/* 2 · resemblance: your photo + a tight face crop of the avatar */}
        <div className="grid grid-cols-2 gap-2">
          <Panel label="Your photo">
            {upload
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={upload} alt="" className="h-full w-full object-cover" />
              : <span className="flex h-full items-center justify-center text-[10px] text-neutral-400">—</span>}
          </Panel>
          <Panel label="Face">
            {/* Full-body figure: zoom into the top-centre (head) for a real face crop. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.imageDataUrl} alt="" className="w-full" style={{ transform: "scale(3)", transformOrigin: "top center" }} />
          </Panel>
        </div>
      </>
    );
  },

  DetailsView({ spec, result }) {
    const dna = scoreAvatarDna(spec);
    return (
      <div className="space-y-2 rounded-2xl border border-timber/10 bg-parchment/40 p-3 text-[11px] text-ink/60">
        <div className="grid grid-cols-2 gap-1">{dna.checks.map((c) => <p key={c.label}>{c.ok ? "✓" : "⚠"} {c.label}</p>)}</div>
        <p>camera {spec.canonicalPose} · transparent · privacy {spec.privacyScope} · gen ${(result.costUsd ?? 0).toFixed(3)}</p>
      </div>
    );
  },

  SavedView({ info }) {
    return (
      <>
        <div className="mx-auto w-1/2 overflow-hidden rounded-2xl border border-neutral-200" style={{ aspectRatio: "3 / 4" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}<img src={info.imageDataUrl} alt={info.name} className="h-full w-full object-contain" />
        </div>
        <p className="text-lg font-black">✓ {info.name} is your avatar</p>
        <p className="text-xs text-neutral-500">Set as your active profile avatar · private id <span className="font-mono">{info.id}</span></p>
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-700">Your photo stays private. Your avatar appears on your profile and under Assets → My Avatar in the editor. Delete it any time.</p>
      </>
    );
  },
};

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[9px] uppercase tracking-wide text-neutral-400">{label}</p>
      <div className="aspect-square overflow-hidden rounded-lg border border-neutral-200 bg-white">{children}</div>
    </div>
  );
}
