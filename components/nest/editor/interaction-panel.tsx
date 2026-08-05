"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, Play, Trash2, X } from "lucide-react";
import { MobileBottomSheet, type BottomSheetSnapPoint } from "@/components/nest/editor/mobile-bottom-sheet";
import {
  capabilitiesForAsset,
  type AssetInteractionConfig,
  type ConnectedContent,
  type ConnectedContentKind,
} from "@/lib/nest-asset-interaction";
import { safeUrl, youTubeVideoId } from "@/lib/nest-interaction";
import type { EditableNestObject } from "@/lib/nest-editor-types";

// ── M25B §P5 — the Interaction sheet, rebuilt as a creator flow ──────────────
//
// The old panel was a settings form: every option and every field on screen at once, under
// uppercase micro-labels, with a button called "Save connection". It answered "configure
// the asset's capability schema". This one answers one question:
//
//     What should happen when someone taps this?
//
// Three steps, one at a time — behaviour → content → starting state — with one sticky
// primary action. Nothing about capabilities, bindings, surfaces or scenes is visible.
//
// Two non-obvious rules are baked in, both of which were bugs in M25:
//
//  • EVERY text input is 16px (`text-base`). Below 16px, iOS Safari zooms the whole page
//    on focus and does not reliably zoom back out — the founder's "page stays enlarged".
//    The fix is font size, never `maximum-scale=1`, which would also disable the pinch
//    accessibility zoom for everyone.
//
//  • The save reads its values from REFS as well as state, and commits the whole config in
//    one object. See `save()`.

type Step = "behaviour" | "content";

const KIND_LABEL: Record<ConnectedContentKind, string> = {
  youtube: "YouTube",
  video: "Video",
  audio: "Audio",
  website: "Website",
  image: "Image",
};

const PLACEHOLDER: Record<ConnectedContentKind, string> = {
  youtube: "youtu.be/… or youtube.com/watch?v=…",
  video: "https://…/clip.mp4",
  audio: "https://…/track.mp3",
  website: "https://example.com",
  image: "https://…/photo.jpg",
};

export function InteractionPanel({
  object,
  assetName,
  assetThumbUrl,
  snap,
  onSnapChange,
  onCommit,
  onClose,
  onTest,
}: {
  object: EditableNestObject;
  assetName: string;
  assetThumbUrl?: string;
  snap: BottomSheetSnapPoint;
  onSnapChange: (s: BottomSheetSnapPoint) => void;
  onCommit: (config: AssetInteractionConfig | undefined) => void;
  onClose: () => void;
  /** Open the real visitor runtime on this Nest, then come back. */
  onTest?: () => void;
}) {
  const def = capabilitiesForAsset(object.assetId);
  const cfg = object.assetInteraction;

  const [step, setStep] = useState<Step>("behaviour");
  const [kind, setKind] = useState<ConnectedContentKind | "">(cfg?.connection?.kind ?? "");
  const [url, setUrl] = useState(cfg?.connection?.url ?? "");
  const [label, setLabel] = useState(cfg?.connection?.label ?? "");
  const [initial, setInitial] = useState<string>(cfg?.initialState ?? def?.defaultState ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── The Save fix, part 1 ───────────────────────────────────────────────────
  //
  // The values are mirrored into refs. A controlled <input> on iOS can deliver its final
  // `onChange` AFTER the button's pointer sequence begins (the keyboard dismissal reorders
  // events), so reading React state inside the handler could see the value from before the
  // last keystroke. The ref is written synchronously on every change, so it is always
  // current by the time save runs.
  const urlRef = useRef(url);
  const labelRef = useRef(label);
  const kindRef = useRef(kind);
  urlRef.current = url;
  labelRef.current = label;
  kindRef.current = kind;

  // ── The Save fix, part 2 ───────────────────────────────────────────────────
  //
  // Re-seed from the document ONLY when a different object is selected. The old version
  // also depended on `cfg.connection.url`, so the moment a save landed the effect fired and
  // reset the local fields from the freshly-committed document — which read to the creator
  // as "Save did nothing", and clobbered any keystroke made in between.
  useEffect(() => {
    const c = object.assetInteraction;
    const d = capabilitiesForAsset(object.assetId);
    setStep("behaviour");
    setKind(c?.connection?.kind ?? "");
    setUrl(c?.connection?.url ?? "");
    setLabel(c?.connection?.label ?? "");
    setInitial(c?.initialState ?? d?.defaultState ?? "");
    setError(null);
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- identity of the SELECTION only
  }, [object.instanceId]);

  const states = useMemo(() => (def ? Object.keys(def.states) : []), [def]);
  const hasToggle = Boolean(def?.toggleTo);
  const canConnect = Boolean(def?.accepts.length);

  const header = (
    <div className="flex items-center gap-2.5 px-4 pb-2 pt-1">
      {step === "content" ? (
        <button type="button" onClick={() => setStep("behaviour")} aria-label="Back" className="-ml-1 grid size-8 shrink-0 place-items-center rounded-full text-ink/50 hover:bg-ink/5">
          <ChevronLeft className="size-5" />
        </button>
      ) : assetThumbUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element -- local curated art */
        <img src={assetThumbUrl} alt="" className="size-9 shrink-0 rounded-lg object-contain" />
      ) : null}
      <div className="min-w-0 flex-1">
        <h3 className="display truncate text-[17px] leading-tight text-ink">{assetName}</h3>
        <p className="truncate text-[12px] text-ink/45">
          {!def ? "Decoration" : cfg?.connection || cfg?.initialState ? "Interactive" : "No interaction yet"}
        </p>
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full text-ink/45 hover:bg-ink/5">
        <X className="size-5" />
      </button>
    </div>
  );

  // Scenery: say so plainly rather than offering controls that do nothing.
  if (!def) {
    return (
      <MobileBottomSheet open label="Interaction" header={header} snap={snap} onSnapChange={onSnapChange} onClose={onClose}>
        <div className="px-4 pb-8">
          <p className="text-[15px] leading-relaxed text-ink/65">
            This one is decoration. Visitors can zoom right in on it, so it is worth placing
            carefully — but there is nothing to switch on.
          </p>
        </div>
      </MobileBottomSheet>
    );
  }

  function commit(next: AssetInteractionConfig | undefined) {
    onCommit(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  function save() {
    if (saving) return; // one commit per tap, never a double-write
    const k = kindRef.current;
    const raw = urlRef.current.trim();
    const lbl = labelRef.current.trim();

    let connection: ConnectedContent | undefined;
    if (k) {
      if (!raw) {
        setError("Add a link first, or choose “Nothing”.");
        return;
      }
      const safe = safeUrl(raw);
      if (!safe) {
        setError("That link doesn’t look right. It should start with https://");
        return;
      }
      if (k === "youtube" && !youTubeVideoId(safe)) {
        setError("We can’t find a video in that link. Copy the address from the video’s page.");
        return;
      }
      connection = { kind: k, url: safe, ...(lbl ? { label: lbl } : {}) };
    }

    setSaving(true);
    setError(null);
    // The WHOLE config in one object — never two patches, which could interleave and lose
    // one half of the creator's change.
    const next: AssetInteractionConfig | undefined =
      connection || initial ? { ...(initial ? { initialState: initial } : {}), ...(connection ? { connection } : {}) } : undefined;
    commit(next);
    setSaving(false);
  }

  const configured = Boolean(cfg?.connection || cfg?.initialState);

  return (
    <MobileBottomSheet open label="Interaction" header={header} snap={snap} onSnapChange={onSnapChange} onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {step === "behaviour" ? (
            <div className="space-y-2.5">
              {hasToggle ? (
                <OptionCard
                  title={def.capabilities.includes("open-close") ? "Open and close it" : "Turn it on and off"}
                  body={
                    def.capabilities.includes("open-close")
                      ? "Visitors tap it to open it, and tap again to close."
                      : "Visitors tap it to switch it on, and tap again to switch it off."
                  }
                  selected
                />
              ) : null}

              {canConnect ? (
                <OptionCard
                  title={def.screenSurfaceId ? "Play something on it" : "Open something"}
                  body={
                    kind
                      ? `${KIND_LABEL[kind]}${url ? ` · ${shortUrl(url)}` : " · no link yet"}`
                      : "Show a video, image or website when someone taps it."
                  }
                  action
                  onClick={() => setStep("content")}
                />
              ) : (
                <p className="pt-1 text-[13px] leading-relaxed text-ink/45">
                  This one doesn’t take a link — tapping it just changes how it looks.
                </p>
              )}

              {hasToggle ? (
                <div className="pt-2">
                  <p className="mb-1.5 text-[13px] font-bold text-ink/55">How it starts</p>
                  <div className="flex gap-1.5">
                    {states.map((sid) => (
                      <button
                        key={sid}
                        type="button"
                        onClick={() => setInitial(sid)}
                        className={`flex-1 rounded-xl px-3 py-2.5 text-[15px] font-bold transition ${
                          initial === sid ? "bg-ink text-parchment" : "bg-ink/[0.05] text-ink/60"
                        }`}
                      >
                        Starts {def.states[sid]?.label?.toLowerCase() ?? sid}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <Chip active={kind === ""} onClick={() => { setKind(""); setUrl(""); setError(null); }}>Nothing</Chip>
                {def.accepts.map((k) => (
                  <Chip key={k} active={kind === k} onClick={() => { setKind(k); setError(null); }}>
                    {KIND_LABEL[k]}
                  </Chip>
                ))}
              </div>

              {kind ? (
                <div className="space-y-2.5">
                  <label className="block">
                    <span className="mb-1 block text-[13px] font-bold text-ink/55">Link</span>
                    <input
                      value={url}
                      onChange={(e) => { setUrl(e.target.value); setError(null); }}
                      onFocus={() => onSnapChange("expanded")}
                      type="url"
                      inputMode="url"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="done"
                      placeholder={PLACEHOLDER[kind]}
                      /* text-base = 16px. Anything smaller makes iOS Safari zoom the page
                         on focus, and it does not reliably zoom back out. */
                      className="w-full rounded-xl border border-ink/15 bg-white px-3 py-3 text-base text-ink outline-none focus:border-ink/40"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[13px] font-bold text-ink/55">Name it (optional)</span>
                    <input
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      onFocus={() => onSnapChange("expanded")}
                      enterKeyHint="done"
                      placeholder="my showreel"
                      className="w-full rounded-xl border border-ink/15 bg-white px-3 py-3 text-base text-ink outline-none focus:border-ink/40"
                    />
                  </label>
                </div>
              ) : (
                <p className="text-[13px] leading-relaxed text-ink/45">Tapping it will just change how it looks.</p>
              )}
            </div>
          )}

          {error ? (
            <p role="alert" className="mt-3 rounded-xl bg-terracotta/10 px-3 py-2 text-[13px] font-bold leading-snug text-terracotta">
              {error}
            </p>
          ) : null}

          {configured ? (
            <button
              type="button"
              onClick={() => { commit(undefined); setKind(""); setUrl(""); setLabel(""); setStep("behaviour"); }}
              className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-bold text-ink/40"
            >
              <Trash2 className="size-3.5" /> Remove interaction
            </button>
          ) : null}
        </div>

        {/* Sticky action. `sticky bottom-0` inside the scroll container keeps it above the
            keyboard without needing a visualViewport calculation. */}
        <div className="sticky bottom-0 flex gap-2 border-t border-ink/10 bg-parchment/95 px-4 py-3 backdrop-blur" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
          {onTest ? (
            <button type="button" onClick={onTest} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-ink/15 px-3.5 py-3 text-[15px] font-bold text-ink/70">
              <Play className="size-4" /> Test
            </button>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className={`flex-1 rounded-xl px-4 py-3 text-[15px] font-bold text-parchment transition disabled:opacity-60 ${saved ? "bg-meadow" : "bg-terracotta"}`}
          >
            {saved ? (
              <span className="inline-flex items-center justify-center gap-1.5"><Check className="size-4" /> Saved</span>
            ) : (
              "Save interaction"
            )}
          </button>
        </div>
      </div>
    </MobileBottomSheet>
  );
}

function OptionCard({ title, body, selected, action, onClick }: { title: string; body: string; selected?: boolean; action?: boolean; onClick?: () => void }) {
  const Tag = action ? "button" : "div";
  return (
    <Tag
      {...(action ? { type: "button" as const, onClick } : {})}
      className={`block w-full rounded-2xl border p-3.5 text-left transition ${
        selected ? "border-ink/15 bg-ink/[0.03]" : "border-ink/12 bg-white/60 active:bg-ink/[0.04]"
      }`}
    >
      <p className="text-[15px] font-bold leading-tight text-ink">{title}</p>
      <p className="mt-1 text-[13px] leading-snug text-ink/50">{body}</p>
    </Tag>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-[14px] font-bold transition ${active ? "bg-ink text-parchment" : "bg-ink/[0.05] text-ink/60"}`}
    >
      {children}
    </button>
  );
}

function shortUrl(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u.slice(0, 28);
  }
}
