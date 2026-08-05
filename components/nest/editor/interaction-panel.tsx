"use client";

import { useEffect, useState } from "react";
import { Link2, Sparkles, X } from "lucide-react";
import { MobileBottomSheet, type BottomSheetSnapPoint } from "@/components/nest/editor/mobile-bottom-sheet";
import {
  capabilitiesForAsset,
  creatorActionsFor,
  stateLabel,
  type AssetInteractionConfig,
  type ConnectedContent,
  type ConnectedContentKind,
} from "@/lib/nest-asset-interaction";
import { safeUrl, youTubeVideoId } from "@/lib/nest-interaction";
import type { EditableNestObject } from "@/lib/nest-editor-types";

// ── M25 §P3 — ONE object-level Interaction panel ─────────────────────────────
//
// This replaces Connect + Surface + Focus, which between them exposed hotspot bindings,
// surface projection, child scenes and target scenes — our vocabulary for our problems,
// none of which a creator should ever have to learn.
//
// What a creator sees now: "What happens when someone taps this?" plus the options THIS
// asset actually supports. A lamp offers no URL field, because a lamp has nowhere to
// send you. A TV offers a screen connection, because it has a screen.

const KIND_LABEL: Record<ConnectedContentKind, string> = {
  youtube: "YouTube video",
  video: "Video link",
  audio: "Audio track",
  website: "Website",
  image: "Image",
};

const PLACEHOLDER: Record<ConnectedContentKind, string> = {
  youtube: "https://youtube.com/watch?v=…",
  video: "https://…/clip.mp4",
  audio: "https://…/track.mp3",
  website: "https://example.com",
  image: "https://…/photo.jpg",
};

export function InteractionPanel({
  object,
  assetName,
  snap,
  onSnapChange,
  onCommit,
  onClose,
}: {
  object: EditableNestObject;
  assetName: string;
  snap: BottomSheetSnapPoint;
  onSnapChange: (s: BottomSheetSnapPoint) => void;
  onCommit: (config: AssetInteractionConfig | undefined) => void;
  onClose: () => void;
}) {
  const def = capabilitiesForAsset(object.assetId);
  const actions = creatorActionsFor(object.assetId);
  const cfg = object.assetInteraction;

  const [kind, setKind] = useState<ConnectedContentKind | "">(cfg?.connection?.kind ?? "");
  const [url, setUrl] = useState(cfg?.connection?.url ?? "");
  const [label, setLabel] = useState(cfg?.connection?.label ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setKind(cfg?.connection?.kind ?? "");
    setUrl(cfg?.connection?.url ?? "");
    setLabel(cfg?.connection?.label ?? "");
    setError(null);
  }, [object.instanceId, cfg?.connection?.kind, cfg?.connection?.url, cfg?.connection?.label]);

  const header = (
    <div className="px-3 pb-1 pt-1">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-teal">Interaction</p>
          <h3 className="display truncate text-base leading-tight text-ink">{assetName}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink/55 hover:bg-ink/5">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );

  // Scenery. Say so plainly instead of offering controls that do nothing — a creator who
  // configures a plant and then finds it inert has been misled by the UI.
  if (!def) {
    return (
      <MobileBottomSheet open label="Interaction" header={header} snap={snap} onSnapChange={onSnapChange} onClose={onClose}>
        <div className="px-3 pb-6 pt-2">
          <p className="text-sm text-ink/70">
            <strong className="font-black">{assetName}</strong> is decoration — visitors can look at it and
            zoom in on it, but there is nothing to switch on.
          </p>
          <p className="mt-2 text-xs text-ink/45">
            Visitors can pinch to zoom right in on it, so small details are worth placing.
          </p>
        </div>
      </MobileBottomSheet>
    );
  }

  const states = Object.keys(def.states);
  const initial = cfg?.initialState && def.states[cfg.initialState] ? cfg.initialState : def.defaultState;

  const patch = (next: Partial<AssetInteractionConfig>) => {
    const merged: AssetInteractionConfig = { ...cfg, ...next };
    const empty = !merged.initialState && !merged.connection && !merged.disabled;
    onCommit(empty ? undefined : merged);
  };

  const saveConnection = () => {
    if (!kind) {
      patch({ connection: undefined });
      setError(null);
      return;
    }
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Add a link, or choose “Nothing”.");
      return;
    }
    if (!safeUrl(trimmed)) {
      setError("That doesn’t look like a safe link. Use a full https:// address.");
      return;
    }
    if (kind === "youtube" && !youTubeVideoId(trimmed)) {
      setError("That isn’t a YouTube link we can play. Paste the address from the video’s page.");
      return;
    }
    setError(null);
    const connection: ConnectedContent = { kind, url: trimmed, ...(label.trim() ? { label: label.trim() } : {}) };
    patch({ connection });
  };

  return (
    <MobileBottomSheet open label="Interaction" header={header} snap={snap} onSnapChange={onSnapChange} onClose={onClose}>
      <div className="space-y-4 px-3 pb-8 pt-2">
        {/* What tapping does — described, not configured. The behaviour comes from the
            asset; the creator chooses its starting point and what it is connected to. */}
        <section>
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-ink/40">When someone taps it</p>
          <ul className="mt-1.5 space-y-1">
            {actions.map((a) => (
              <li key={a.id} className="flex gap-2 rounded-xl bg-ink/[0.04] px-2.5 py-2">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />
                <span className="text-xs leading-snug text-ink/75">
                  <strong className="font-black text-ink">{a.label}.</strong> {a.help}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Initial state */}
        {def.toggleTo ? (
          <section>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-ink/40">How it starts</p>
            <div className="mt-1.5 flex gap-1.5">
              {states.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => patch({ initialState: s })}
                  className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                    initial === s ? "bg-terracotta text-parchment" : "bg-ink/[0.06] text-ink/65"
                  }`}
                >
                  {stateLabel(object.assetId, s)}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* Connected content — only for assets that accept any. */}
        {def.accepts.length ? (
          <section>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-ink/40">
              {def.screenSurfaceId ? "What plays on it" : "What it opens"}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <ChoiceChip active={kind === ""} onClick={() => { setKind(""); patch({ connection: undefined }); }}>
                Nothing
              </ChoiceChip>
              {def.accepts.map((k) => (
                <ChoiceChip key={k} active={kind === k} onClick={() => setKind(k)}>
                  {KIND_LABEL[k]}
                </ChoiceChip>
              ))}
            </div>

            {kind ? (
              <div className="mt-2.5 space-y-2">
                <label className="block">
                  <span className="text-[11px] font-bold text-ink/55">Link</span>
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onFocus={() => onSnapChange("expanded")}
                    inputMode="url"
                    placeholder={PLACEHOLDER[kind]}
                    className="mt-1 w-full rounded-xl border border-ink/15 bg-parchment px-3 py-2.5 text-sm text-ink outline-none focus:border-teal"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-bold text-ink/55">Name it (optional)</span>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    onFocus={() => onSnapChange("expanded")}
                    placeholder="my showreel"
                    className="mt-1 w-full rounded-xl border border-ink/15 bg-parchment px-3 py-2.5 text-sm text-ink outline-none focus:border-teal"
                  />
                </label>
                {error ? <p className="text-xs font-bold text-terracotta">{error}</p> : null}
                <button
                  type="button"
                  onClick={saveConnection}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-teal px-4 py-2.5 text-sm font-bold text-parchment"
                >
                  <Link2 className="h-4 w-4" /> Save connection
                </button>
              </div>
            ) : null}
          </section>
        ) : (
          <p className="text-xs text-ink/45">
            This one doesn’t take a link — tapping it just changes how it looks.
          </p>
        )}

        <p className="text-[11px] leading-snug text-ink/40">
          Test it in <strong className="font-bold text-ink/60">Preview</strong> — that is exactly what
          visitors get.
        </p>
      </div>
    </MobileBottomSheet>
  );
}

function ChoiceChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${active ? "bg-ink text-parchment" : "bg-ink/[0.06] text-ink/60"}`}
    >
      {children}
    </button>
  );
}
