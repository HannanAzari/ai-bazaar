"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Image as ImageIcon,
  Lamp,
  Leaf,
  Library,
  PenTool,
  Pin,
  Sofa,
  Square,
  Table,
  Tv,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import type {
  ComposedNest,
  Interaction,
  NestAmbiencePreset,
  NestAsset,
  NestContentType,
  NestSlotType,
  NestTemplate,
} from "@/lib/nest-types";
import {
  aspectRatioCss,
  interactionEffect,
  isInteractivePiece,
  resolveRenderPieces,
  slotBoxStyle,
  type NestRenderPiece,
} from "@/lib/nest-render";

// Golden Nest renderer. Renders one front-facing Nest from the data contract:
// template background + transparent cut-outs snapped into normalized slot bounds,
// z-ordered + grounded with soft contact shadows, with tap interactions surfaced
// in a compact bottom-sheet drawer. The slot debug overlay is opt-in via
// `showOverlays` (debug mode only). Reduced-motion is honored (global rule + the
// scoped guard below). No rectangular wrappers/cards around objects: effect halos
// use silhouette-following drop-shadows, never box-shadow rings.

type Props = {
  template: NestTemplate;
  assetsById: Record<string, NestAsset>;
  interactionsById: Record<string, Interaction>;
  composed: ComposedNest;
  /** Debug calibration overlay (slot bounds + metadata). Off in presentation. */
  showOverlays?: boolean;
};

const ICON_BY_SLOT: Record<NestSlotType, LucideIcon> = {
  media: Tv,
  frame: ImageIcon,
  shelf: Library,
  books: BookOpen,
  desk: PenTool,
  plant: Leaf,
  lamp: Lamp,
  avatar: User,
  window: ImageIcon,
  product: Library,
  // Production Pack V1 additions (M9.1)
  seat: Sofa,
  table: Table,
  rug: Square,
  pinboard: Pin,
};

export function GoldenNestStage({ template, assetsById, interactionsById, composed, showOverlays = false }: Props) {
  const pieces = useMemo(
    () => resolveRenderPieces(composed, template, assetsById, interactionsById),
    [composed, template, assetsById, interactionsById],
  );

  const [selectedSlotId, setSelectedSlotId] = useState<string | undefined>(undefined);
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({});
  const [wiggleTick, setWiggleTick] = useState<Record<string, number>>({});
  const [ambienceIndex, setAmbienceIndex] = useState(() => {
    const i = template.ambiencePresets.findIndex((p) => p.id === composed.ambiencePresetId);
    return i >= 0 ? i : 0;
  });

  const ambience: NestAmbiencePreset | undefined = template.ambiencePresets[ambienceIndex];
  const selected = pieces.find((p) => p.slot.id === selectedSlotId);

  const bgRef = useRef<HTMLImageElement>(null);
  const [bgFailed, setBgFailed] = useState(false);
  useEffect(() => {
    const img = bgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setBgFailed(true);
  }, [template.backgroundImageUrl]);

  function handleActivate(piece: NestRenderPiece) {
    setSelectedSlotId(piece.slot.id);
    const effect = interactionEffect(piece.interaction);
    if (effect === "ambience") {
      setAmbienceIndex((i) => (i + 1) % Math.max(1, template.ambiencePresets.length));
      setActiveStates((s) => ({ ...s, [piece.slot.id]: !s[piece.slot.id] }));
    } else if (effect === "wiggle") {
      setWiggleTick((s) => ({ ...s, [piece.slot.id]: (s[piece.slot.id] ?? 0) + 1 }));
    } else if (effect !== "none") {
      setActiveStates((s) => ({ ...s, [piece.slot.id]: !s[piece.slot.id] }));
    }
  }

  function closeDrawer() {
    if (selected) setActiveStates((s) => ({ ...s, [selected.slot.id]: false }));
    setSelectedSlotId(undefined);
  }

  return (
    <div className="mx-auto w-full" style={{ maxWidth: "min(94vw, 460px)" }}>
      <style>{STAGE_CSS}</style>
      <div
        className="nest-scene relative overflow-hidden rounded-[28px] border border-ink/10 shadow-xl"
        style={{ aspectRatio: aspectRatioCss(template.aspectRatio) }}
      >
        {/* Background: real template image, else a warm gradient fallback. */}
        <div className="absolute inset-0 nest-bg-fallback" aria-hidden />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={bgRef}
          src={template.backgroundImageUrl}
          alt=""
          aria-hidden
          style={{ opacity: bgFailed ? 0 : 1 }}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setBgFailed(true)}
        />

        {/* Ambience tint (subtle; warm/cool law). */}
        {ambience ? (
          <div
            className="pointer-events-none absolute inset-0 mix-blend-soft-light transition-[background-color,opacity] duration-500"
            style={{ backgroundColor: ambience.tint, opacity: Math.min(0.6, ambience.intensity) }}
            aria-hidden
          />
        ) : null}

        {/* Objects, z-ordered (resolveRenderPieces sorts ascending). */}
        {pieces.map((piece) => (
          <Piece
            key={piece.slot.id}
            piece={piece}
            active={Boolean(activeStates[piece.slot.id])}
            wiggleTick={wiggleTick[piece.slot.id] ?? 0}
            onActivate={handleActivate}
          />
        ))}

        {/* Debug calibration overlay (debug mode only). */}
        {showOverlays
          ? pieces.map((piece) => {
              const box = slotBoxStyle(piece.slot);
              const b = piece.slot.bounds;
              const a = piece.slot.anchorPoint;
              return (
                <div
                  key={`dbg-${piece.slot.id}`}
                  className="pointer-events-none absolute z-[999] border-2 border-dashed border-terracotta/70"
                  style={{ ...box }}
                >
                  <span className="absolute left-0 top-0 -translate-y-full whitespace-nowrap rounded-t bg-terracotta px-1 py-0.5 text-[8px] font-bold leading-tight text-white">
                    {piece.slot.id} · {piece.assignment.assetId}
                    <br />
                    z{piece.slot.zIndex} · {piece.slot.plane} · ×{piece.slot.scaleRef ?? "—"}
                    <br />
                    b {b.x.toFixed(2)},{b.y.toFixed(2)} {b.width.toFixed(2)}×{b.height.toFixed(2)} · a {a.x.toFixed(2)},{a.y.toFixed(2)}
                  </span>
                  <span
                    className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cobalt ring-1 ring-white"
                    style={{ left: `${((a.x - b.x) / b.width) * 100}%`, top: `${((a.y - b.y) / b.height) * 100}%` }}
                  />
                </div>
              );
            })
          : null}

        {/* Compact interaction drawer (collapsed hint, or selected-object sheet). */}
        <Drawer piece={selected} onClose={closeDrawer} />
      </div>
    </div>
  );
}

function Piece({
  piece,
  active,
  wiggleTick,
  onActivate,
}: {
  piece: NestRenderPiece;
  active: boolean;
  wiggleTick: number;
  onActivate: (p: NestRenderPiece) => void;
}) {
  const box = slotBoxStyle(piece.slot);
  const effect = interactionEffect(piece.interaction);
  const interactive = isInteractivePiece(piece);
  const Icon = ICON_BY_SLOT[piece.slot.slotType] ?? ImageIcon;
  const label = piece.asset?.name ?? `Missing: ${piece.assignment.assetId}`;
  const artUrl = piece.asset?.imageUrl;
  const floorAligned = piece.slot.plane === "floor" || piece.slot.plane === "foreground";
  const imgRef = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  const showPlaceholder = !artUrl || failed;

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [artUrl]);

  const effectClass = [
    (effect === "glow" || effect === "ambience") && active ? "nest-fx-glow" : "",
    effect === "open" && active ? "nest-fx-open" : "",
    effect === "zoom" && active ? "nest-fx-zoom" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <div className={`nest-piece relative h-full w-full ${effectClass}`}>
      {/* Soft contact shadow for floor-standing objects (grounding). */}
      {piece.slot.contactShadow ? <div className="nest-contact-shadow" aria-hidden /> : null}

      {/* Placeholder (only visible if art is missing/failed — never over real art). */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center rounded-xl text-center transition-opacity ${
          piece.missing ? "border border-terracotta/60 bg-terracotta/10" : ""
        } ${showPlaceholder ? "opacity-100" : "opacity-0"}`}
      >
        <Icon className="h-1/3 max-h-10 w-auto text-ink/60" aria-hidden />
        <span className="mt-1 max-w-full truncate px-1 text-[10px] font-bold text-ink/60">{label}</span>
      </div>

      {/* Real art (fixture-driven `asset.imageUrl`). */}
      {artUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={artUrl}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          style={{ opacity: failed ? 0 : 1 }}
          className={`relative h-full w-full object-contain ${floorAligned ? "object-bottom" : "object-center"}`}
        />
      ) : null}
    </div>
  );

  const common = {
    className: "absolute",
    style: { ...box, zIndex: piece.slot.zIndex } as React.CSSProperties,
  };

  if (!interactive) {
    return <div {...common}>{body}</div>;
  }

  return (
    <button
      type="button"
      {...common}
      key={`${piece.slot.id}-${effect === "wiggle" ? wiggleTick : "x"}`}
      onClick={() => onActivate(piece)}
      aria-label={`${label} — ${piece.interaction?.name ?? "interactive"}`}
      className={`absolute cursor-pointer ${effect === "wiggle" ? "nest-fx-wiggle" : ""}`}
    >
      {body}
    </button>
  );
}

/** Friendly, one-action label per content type (the drawer CTA). */
function friendlyAction(ct?: NestContentType): string | null {
  switch (ct) {
    case "video":
      return "Watch latest video";
    case "gallery":
      return "Open gallery";
    case "article":
      return "Read article";
    case "intro":
      return "Meet the creator";
    case "website":
      return "Open website";
    case "music":
      return "Open music";
    case "podcast":
      return "Open podcast";
    case "shop":
      return "Open shop";
    case "achievements":
      return "View achievements";
    case "ambience":
      return "Change ambience";
    default:
      return null;
  }
}

function Drawer({ piece, onClose }: { piece?: NestRenderPiece; onClose: () => void }) {
  if (!piece) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[60] flex justify-center p-2">
        <span className="rounded-full border border-ink/15 bg-parchment-light/90 px-3.5 py-1.5 text-[11px] font-bold text-ink/75 shadow-sm backdrop-blur-md">
          Tap an object to explore
        </span>
      </div>
    );
  }

  const ct = piece.interaction?.contentType;
  const action = friendlyAction(ct);
  const href = piece.assignment.content?.url;

  return (
    <div className="absolute inset-x-0 bottom-0 z-[60] p-2">
      <div className="nest-sheet rounded-2xl border border-ink/10 bg-parchment-light/92 p-3 shadow-lg backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="display truncate text-base leading-tight text-ink">{piece.asset?.name ?? piece.assignment.assetId}</h3>
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink/45">
              {piece.assignment.content?.title ?? (ct ? ct : "object")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1 text-ink/45 hover:bg-ink/5 hover:text-ink/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {action ? (
          href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-parchment-light hover:bg-ink/85"
            >
              {action} ↗
            </a>
          ) : (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-ink/90 px-4 py-1.5 text-xs font-bold text-parchment-light">
              {action}
            </span>
          )
        ) : (
          <p className="mt-1 text-xs text-ink/45">A little piece of this home.</p>
        )}
      </div>
    </div>
  );
}

// Scoped styles. Effect halos use drop-shadow (follows the cut-out silhouette) —
// never box-shadow/ring (which would draw a rectangular "container" around the
// transparent art). Reduced-motion neutralizes transitions + keyframes.
const STAGE_CSS = `
.nest-scene { background: linear-gradient(180deg, #efe2c4 0%, #e7d3ad 62%, #d8c096 100%); }
.nest-bg-fallback { background:
  radial-gradient(120% 80% at 50% 0%, #fff6e0 0%, rgba(255,246,224,0) 55%),
  linear-gradient(180deg, #efe2c4 0%, #e7d3ad 61%, #d8c096 100%); }
.nest-piece { transition: transform .22s ease, filter .22s ease; }
.nest-contact-shadow { position:absolute; left:50%; bottom:0; width:70%; aspect-ratio:6 / 1; transform:translate(-50%,36%); background:radial-gradient(50% 50% at 50% 50%, rgba(70,54,90,.30) 0%, rgba(70,54,90,.12) 55%, rgba(70,54,90,0) 75%); filter:blur(2px); pointer-events:none; z-index:0; }
.nest-fx-glow { transform: scale(1.02); filter: brightness(1.07) drop-shadow(0 0 12px rgba(255,197,92,.75)); }
.nest-fx-open { transform: translateY(-7%) scale(1.03); filter: drop-shadow(0 10px 8px rgba(70,54,90,.26)); }
.nest-fx-zoom { transform: scale(1.07); filter: drop-shadow(0 8px 12px rgba(70,54,90,.28)); z-index: 50; }
@keyframes nest-wiggle { 0%{transform:rotate(0)} 25%{transform:rotate(-3.5deg)} 50%{transform:rotate(2.5deg)} 75%{transform:rotate(-1.5deg)} 100%{transform:rotate(0)} }
.nest-fx-wiggle { animation: nest-wiggle .6s ease-in-out 1; transform-origin: bottom center; }
@keyframes nest-sheet-up { from{transform:translateY(10px);opacity:.3} to{transform:translateY(0);opacity:1} }
.nest-sheet { animation: nest-sheet-up .24s ease; }
@media (prefers-reduced-motion: reduce) {
  .nest-piece { transition: none; }
  .nest-fx-wiggle, .nest-sheet { animation: none; }
}
`;
