"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { ComposedNest, Interaction, NestAmbiencePreset, NormalizedRect } from "@/lib/nest-types";
import type {
  LivingNestAsset,
  LivingNestSlot,
  LivingNestTemplate,
} from "@/lib/nest-visual-types";
import type { NestAssetHotspot, NestHotspotSemantic } from "@/lib/nest-hotspot-types";
import { aspectRatioCss } from "@/lib/nest-render";

// Golden Living Nest renderer (M5 + M7B hotspots). Renders one premium front-facing
// living room with LAYERED interactions so only the meaningful part of an object
// changes (TV screen, plant leaves, frame image, lamp glow, avatar greeting).
//
// M7B: an asset instance may carry interaction HOTSPOTS (asset-local sub-regions).
// When present, only the precise hotspot is the hit target — the whole-object
// interaction does NOT fire. Hotspots render inside the asset's transformed container
// so they follow move/resize/rotation/flip automatically. Authoring overlays are
// hidden in visitor Preview; an internal `debugHotspots` toggle reveals them. Assets
// without hotspots keep their whole-object interaction (backward-compatible).
// No Three.js / WebGL / GIF — CSS transforms + clipped raster layers only.

type Props = {
  template: LivingNestTemplate;
  assetsById: Record<string, LivingNestAsset>;
  interactionsById: Record<string, Interaction>;
  composed: ComposedNest;
  /** Debug calibration overlay (off in presentation). */
  showOverlays?: boolean;
  /** Internal: reveal hotspot regions for testing (off in normal visitor Preview). */
  debugHotspots?: boolean;
  /** Full-bleed: drop the centred max-width card chrome so a parent can size it (M7C.3). */
  fill?: boolean;
  /** Transparent: skip the background image + gradient so this stage can overlay another
   *  (M7C.6 — a child Focus Scene's objects layered over the parent-crop base). */
  transparent?: boolean;
};

type Piece = {
  slot: LivingNestSlot;
  asset?: LivingNestAsset;
  assetId: string;
  interaction?: Interaction;
  content?: { contentType: string; url?: string; title?: string };
  missing: boolean;
};

type Effect = "screen" | "leaf" | "avatar" | "focus" | "lampglow" | "static";

function effectFor(piece: Piece): Effect {
  const t = piece.slot.slotType;
  if (t === "media") return "screen";
  if (t === "plant") return "leaf";
  if (t === "avatar") return "avatar";
  if (t === "frame") return "focus";
  if (t === "lamp") return "lampglow";
  return "static";
}

/** The effect a hotspot triggers (asset-level effect when it matches, else a local highlight). */
function hotspotEffect(piece: Piece, h: NestAssetHotspot): Effect | "highlight" {
  const t = piece.slot.slotType;
  if (t === "media" && h.semantic === "video") return "screen";
  if (t === "plant" && h.semantic === "animation") return "leaf";
  if (t === "avatar" && h.semantic === "profile") return "avatar";
  if (t === "lamp" && h.semantic === "ambience") return "lampglow";
  if (t === "frame" && h.semantic === "gallery") return "focus";
  return "highlight";
}

function pct(n: number): string {
  return `${+(n * 100).toFixed(3)}%`;
}

function boxStyle(b: NormalizedRect): { left: string; top: string; width: string; height: string } {
  return { left: pct(b.x), top: pct(b.y), width: pct(b.width), height: pct(b.height) };
}

export function GoldenLivingNestStage({
  template,
  assetsById,
  interactionsById,
  composed,
  showOverlays = false,
  debugHotspots = false,
  fill = false,
  transparent = false,
}: Props) {
  const pieces = useMemo<Piece[]>(() => {
    const list: Piece[] = [];
    for (const a of composed.slotAssignments) {
      const slot = template.slots.find((s) => s.id === a.slotId);
      if (!slot) continue;
      const asset = assetsById[a.assetId];
      const interactionId = a.interactionId ?? asset?.defaultInteractionId ?? slot.defaultInteractionId;
      list.push({
        slot,
        asset,
        assetId: a.assetId,
        interaction: interactionId ? interactionsById[interactionId] : undefined,
        content: a.content,
        missing: !asset,
      });
    }
    return list.sort((x, y) => x.slot.zIndex - y.slot.zIndex);
  }, [composed, template, assetsById, interactionsById]);

  const [selectedSlotId, setSelectedSlotId] = useState<string | undefined>(undefined);
  const [selectedHotspot, setSelectedHotspot] = useState<{ slotId: string; hotspot: NestAssetHotspot } | undefined>(undefined);
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({});
  const [tapTick, setTapTick] = useState<Record<string, number>>({});
  const [pulses, setPulses] = useState<Record<string, number>>({});
  const [ambienceIndex, setAmbienceIndex] = useState(() => {
    const i = template.ambiencePresets.findIndex((p) => p.id === composed.ambiencePresetId);
    return i >= 0 ? i : 0;
  });

  const ambience: NestAmbiencePreset | undefined = template.ambiencePresets[ambienceIndex];
  const selected = pieces.find((p) => p.slot.id === selectedSlotId);
  const frameFocused = pieces.some((p) => effectFor(p) === "focus" && activeStates[p.slot.id]);

  const bgRef = useRef<HTMLImageElement>(null);
  const [bgFailed, setBgFailed] = useState(false);
  useEffect(() => {
    const img = bgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setBgFailed(true);
  }, [template.backgroundImageUrl]);

  function runEffect(piece: Piece, effect: Effect | "highlight", hotspotId?: string) {
    if (effect === "lampglow") {
      setAmbienceIndex((i) => (i + 1) % Math.max(1, template.ambiencePresets.length));
      setActiveStates((s) => ({ ...s, [piece.slot.id]: !s[piece.slot.id] }));
    } else if (effect === "leaf" || effect === "avatar") {
      setTapTick((s) => ({ ...s, [piece.slot.id]: (s[piece.slot.id] ?? 0) + 1 }));
      setActiveStates((s) => ({ ...s, [piece.slot.id]: true }));
    } else if (effect === "screen" || effect === "focus") {
      setActiveStates((s) => ({ ...s, [piece.slot.id]: !s[piece.slot.id] }));
    } else if (effect === "highlight" && hotspotId) {
      setPulses((p) => ({ ...p, [hotspotId]: (p[hotspotId] ?? 0) + 1 }));
    }
  }

  // Whole-object activation (fallback for assets WITHOUT hotspots).
  function activate(piece: Piece) {
    if (!piece.interaction) return;
    setSelectedSlotId(piece.slot.id);
    setSelectedHotspot(undefined);
    runEffect(piece, effectFor(piece));
  }

  // Hotspot activation (precise sub-region) — the whole-object interaction never fires.
  function activateHotspot(piece: Piece, hotspot: NestAssetHotspot) {
    if (!hotspot.enabled) return;
    setSelectedSlotId(piece.slot.id);
    setSelectedHotspot({ slotId: piece.slot.id, hotspot });
    runEffect(piece, hotspotEffect(piece, hotspot), hotspot.id);
  }

  function closeDrawer() {
    if (selected) setActiveStates((s) => ({ ...s, [selected.slot.id]: false }));
    setSelectedSlotId(undefined);
    setSelectedHotspot(undefined);
  }

  return (
    <div className={fill ? "w-full" : "mx-auto w-full"} style={fill ? undefined : { maxWidth: "min(94vw, 460px)" }}>
      <style>{STAGE_CSS}</style>
      <div
        className={`living-scene relative overflow-hidden ${fill ? "rounded-none border-0 shadow-none" : "rounded-[28px] border border-ink/10 shadow-xl"}`}
        // `transparent` overlays the stage on a parent-crop base (M7C.6/M7C.7): the
        // `.living-scene` beige is a `background` SHORTHAND (a gradient IMAGE), so an inline
        // `background: transparent` is required to clear it — a `background-color` reset
        // (the old `!bg-transparent`) leaves the gradient image opaque and HIDES the base.
        style={{ aspectRatio: aspectRatioCss(template.aspectRatio), ...(transparent ? { background: "transparent" } : null) }}
      >
        {transparent ? null : <div className="absolute inset-0 living-bg-fallback" aria-hidden />}
        {transparent ? null : (
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={bgRef} src={template.backgroundImageUrl} alt="" aria-hidden style={{ opacity: bgFailed ? 0 : 1 }} className="absolute inset-0 h-full w-full object-cover" onError={() => setBgFailed(true)} />
        )}

        {ambience ? (
          <div className="pointer-events-none absolute inset-0 mix-blend-soft-light living-ambience" style={{ backgroundColor: ambience.tint, opacity: Math.min(0.6, ambience.intensity) }} aria-hidden />
        ) : null}

        <div className="pointer-events-none absolute inset-0 bg-ink living-dim" style={{ opacity: frameFocused ? 0.28 : 0 }} aria-hidden />

        {pieces.map((piece) => (
          <PieceView
            key={piece.slot.id}
            piece={piece}
            active={Boolean(activeStates[piece.slot.id])}
            tapTick={tapTick[piece.slot.id] ?? 0}
            focused={effectFor(piece) === "focus" && Boolean(activeStates[piece.slot.id])}
            glow={ambience?.glow ?? "#ffc55c"}
            debugHotspots={debugHotspots}
            pulses={pulses}
            onActivate={activate}
            onActivateHotspot={activateHotspot}
          />
        ))}

        {showOverlays ? <DebugOverlay pieces={pieces} /> : null}

        <Drawer piece={selected} hotspot={selectedHotspot?.hotspot} onClose={closeDrawer} />
      </div>
    </div>
  );
}

function PieceView({
  piece,
  active,
  tapTick,
  focused,
  glow,
  debugHotspots,
  pulses,
  onActivate,
  onActivateHotspot,
}: {
  piece: Piece;
  active: boolean;
  tapTick: number;
  focused: boolean;
  glow: string;
  debugHotspots: boolean;
  pulses: Record<string, number>;
  onActivate: (p: Piece) => void;
  onActivateHotspot: (p: Piece, h: NestAssetHotspot) => void;
}) {
  const box = boxStyle(piece.slot.bounds);
  const effect = effectFor(piece);
  const interactive = Boolean(piece.interaction);
  const artUrl = piece.asset?.imageUrl;
  const floorAligned = piece.slot.plane === "floor" || piece.slot.plane === "foreground";
  const objPos = floorAligned ? "object-bottom" : "object-center";
  const imgRef = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [artUrl]);

  const screenRect = piece.asset?.statePack?.screenRect;
  const leafSplitY = piece.asset?.statePack?.leafSplitY;
  const hotspots = (piece.slot.hotspots ?? []).filter((h) => debugHotspots || h.enabled);
  const hasHotspots = (piece.slot.hotspots ?? []).some((h) => h.enabled);

  let body: React.ReactNode;

  if (effect === "leaf" && artUrl && leafSplitY != null && !failed) {
    body = (
      <div className="relative h-full w-full">
        {piece.slot.contactShadow ? <div className="living-contact-shadow" aria-hidden /> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artUrl} alt="" draggable={false} className={`absolute inset-0 h-full w-full object-contain ${objPos}`} style={{ clipPath: `inset(${pct(leafSplitY)} 0 0 0)` }} onError={() => setFailed(true)} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={`leaf-${tapTick}`} src={artUrl} alt="" draggable={false} className={`absolute inset-0 h-full w-full object-contain ${objPos} living-leaf ${active ? "living-leaf-tap" : ""}`} style={{ clipPath: `inset(0 0 ${pct(1 - leafSplitY)} 0)`, transformOrigin: `50% ${pct(leafSplitY)}` }} />
      </div>
    );
  } else if (effect === "screen" && artUrl && screenRect && !failed) {
    body = (
      <div className="relative h-full w-full">
        {piece.slot.contactShadow ? <div className="living-contact-shadow" aria-hidden /> : null}
        <div className="pointer-events-none absolute living-spill" style={{ left: pct(screenRect.x - screenRect.width * 0.25), top: pct(screenRect.y - screenRect.height * 0.3), width: pct(screenRect.width * 1.5), height: pct(screenRect.height * 1.6), opacity: active ? 0.85 : 0, background: `radial-gradient(50% 50% at 50% 50%, ${glow}cc 0%, ${glow}00 70%)` }} aria-hidden />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={artUrl} alt="" draggable={false} className={`relative h-full w-full object-contain ${objPos}`} onError={() => setFailed(true)} />
        <div className="pointer-events-none absolute flex items-center justify-center overflow-hidden rounded-[4px] living-screen" style={{ left: pct(screenRect.x), top: pct(screenRect.y), width: pct(screenRect.width), height: pct(screenRect.height), opacity: active ? 1 : 0, background: `linear-gradient(135deg, ${glow}bb, ${glow}33)` }} aria-hidden>
          <span className="flex h-[30%] max-h-7 min-h-4 w-[30%] max-w-7 min-w-4 items-center justify-center rounded-full bg-ink/55">
            <span className="ml-[12%] h-0 w-0 border-y-[5px] border-l-[9px] border-y-transparent border-l-parchment" />
          </span>
        </div>
      </div>
    );
  } else {
    const lampGlow = effect === "lampglow" && active ? (
      <div className="pointer-events-none absolute living-spill" style={{ left: "10%", top: "2%", width: "80%", height: "34%", opacity: 0.9, background: `radial-gradient(50% 50% at 50% 30%, ${glow}cc 0%, ${glow}00 70%)` }} aria-hidden />
    ) : null;
    body = (
      <div className="relative h-full w-full">
        {piece.slot.contactShadow ? <div className="living-contact-shadow" aria-hidden /> : null}
        {lampGlow}
        {artUrl && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={imgRef} src={artUrl} alt="" draggable={false} onError={() => setFailed(true)} className={`relative h-full w-full object-contain ${objPos} ${effect === "avatar" ? `living-avatar ${active ? "living-avatar-tap" : ""}` : ""}`} style={effect === "avatar" ? { transformOrigin: "50% 100%" } : undefined} key={effect === "avatar" ? `av-${tapTick}` : undefined} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-terracotta/50 bg-terracotta/10 text-center text-[10px] font-bold text-ink/60">{piece.asset?.name ?? piece.assetId}</div>
        )}
      </div>
    );
  }

  const style: React.CSSProperties = { ...box, zIndex: piece.slot.zIndex };
  const rot = piece.slot.rotationDeg;
  const flip = piece.slot.flipX;
  if ((rot != null && rot !== 0) || flip) {
    style.transform = `${rot ? `rotate(${rot}deg)` : ""}${flip ? " scaleX(-1)" : ""}`.trim();
    style.transformOrigin = "center";
  }
  const focusClass = effect === "focus" ? `living-focus ${focused ? "living-focus-on" : ""}` : "";

  // ── Hotspot path: the asset is non-interactive; precise regions are the targets ──
  if (hasHotspots) {
    return (
      <div className={`absolute ${focusClass}`} style={style}>
        {body}
        {hotspots.map((h) => (
          <HotspotTarget key={h.id} hotspot={h} debug={debugHotspots} pulse={pulses[h.id] ?? 0} onActivate={() => onActivateHotspot(piece, h)} />
        ))}
      </div>
    );
  }

  // ── Whole-object fallback (no hotspots) ──
  if (!interactive) {
    return <div className={`absolute ${focusClass}`} style={style}>{body}</div>;
  }
  return (
    <button type="button" className={`absolute cursor-pointer ${focusClass}`} style={style} onClick={() => onActivate(piece)} aria-label={`${piece.asset?.name ?? piece.assetId} — ${piece.interaction?.name ?? "interactive"}`}>
      {body}
    </button>
  );
}

function HotspotTarget({ hotspot, debug, pulse, onActivate }: { hotspot: NestAssetHotspot; debug: boolean; pulse: number; onActivate: () => void }) {
  const s = hotspot.shape;
  const ellipse = s.type === "ellipse";
  const disabled = !hotspot.enabled;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onActivate(); }}
      aria-label={hotspot.ariaLabel ?? hotspot.name}
      className={`absolute living-hotspot ${disabled ? "cursor-default" : "cursor-pointer"} ${ellipse ? "rounded-full" : "rounded-[4px]"} ${debug ? (disabled ? "living-hotspot-debug-off" : "living-hotspot-debug") : ""}`}
      style={{ left: pct(s.x), top: pct(s.y), width: pct(s.width), height: pct(s.height) }}
    >
      <span key={pulse} className={pulse ? "living-hotspot-pulse" : ""} />
    </button>
  );
}

function friendlyAction(s?: NestHotspotSemantic): string | null {
  switch (s) {
    case "video": return "Watch latest video";
    case "gallery": return "Open gallery";
    case "article": return "Read article";
    case "website": return "Open website";
    case "music": return "Open music";
    case "podcast": return "Open podcast";
    case "shop": return "Open shop";
    case "profile": return "Meet the creator";
    case "ambience": return "Change ambience";
    case "custom_link": return "Open link";
    default: return null;
  }
}

function Drawer({ piece, hotspot, onClose }: { piece?: Piece; hotspot?: NestAssetHotspot; onClose: () => void }) {
  if (!piece) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[60] flex justify-center p-2">
        <span className="rounded-full border border-ink/15 bg-parchment/90 px-3.5 py-1.5 text-[11px] font-bold text-ink/75 shadow-sm backdrop-blur-md">Tap an object to explore</span>
      </div>
    );
  }
  // Hotspot drawer uses the hotspot's own name + binding, not the whole asset's.
  const title = hotspot ? hotspot.name : (piece.asset?.name ?? piece.assetId);
  const semantic = hotspot?.semantic;
  const action = hotspot ? friendlyAction(semantic) : friendlyAction(undefined) ?? (piece.interaction ? "Open" : null);
  const href = hotspot ? hotspot.binding?.url : piece.content?.url;
  const subtitle = hotspot ? (hotspot.binding?.label ?? semantic) : (piece.content?.title ?? piece.interaction?.contentType ?? "object");
  return (
    <div className="absolute inset-x-0 bottom-0 z-[60] p-2">
      <div className="living-sheet rounded-2xl border border-ink/10 bg-parchment/95 p-3 shadow-lg backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="display truncate text-base leading-tight text-ink">{title}</h3>
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink/45">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 rounded-full p-1 text-ink/45 hover:bg-ink/5 hover:text-ink/70"><X className="h-4 w-4" /></button>
        </div>
        {action ? (
          href ? (
            <a href={href} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-parchment hover:bg-ink/85">{action} ↗</a>
          ) : (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-ink/90 px-4 py-1.5 text-xs font-bold text-parchment">{action}</span>
          )
        ) : (
          <p className="mt-1 text-xs text-ink/45">A little piece of this home.</p>
        )}
      </div>
    </div>
  );
}

function DebugOverlay({ pieces }: { pieces: Piece[] }) {
  return (
    <>
      {pieces.map((piece) => {
        const box = boxStyle(piece.slot.bounds);
        const b = piece.slot.bounds;
        const a = piece.slot.anchorPoint;
        return (
          <div key={`dbg-${piece.slot.id}`} className="pointer-events-none absolute z-[999] border-2 border-dashed border-terracotta/70" style={{ ...box }}>
            <span className="absolute left-0 top-0 -translate-y-full whitespace-nowrap rounded-t bg-terracotta px-1 py-0.5 text-[8px] font-bold leading-tight text-white">
              {piece.slot.id} · {piece.assetId}
              <br />
              {piece.slot.slotType} · z{piece.slot.zIndex} · {(piece.slot.hotspots ?? []).length} hotspots
            </span>
            <span className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cobalt ring-1 ring-white" style={{ left: `${((a.x - b.x) / b.width) * 100}%`, top: `${((a.y - b.y) / b.height) * 100}%` }} />
          </div>
        );
      })}
    </>
  );
}

const STAGE_CSS = `
.living-scene { background: linear-gradient(180deg, #efe2c4 0%, #e7d3ad 62%, #d8c096 100%); }
.living-bg-fallback { background:
  radial-gradient(120% 80% at 50% 0%, #fff6e0 0%, rgba(255,246,224,0) 55%),
  linear-gradient(180deg, #efe2c4 0%, #e7d3ad 61%, #d8c096 100%); }
.living-ambience { transition: background-color .7s ease, opacity .7s ease; }
.living-dim { transition: opacity .45s ease; }
.living-contact-shadow { position:absolute; left:50%; bottom:0; width:72%; aspect-ratio:6 / 1; transform:translate(-50%,34%); background:radial-gradient(50% 50% at 50% 50%, rgba(70,54,90,.32) 0%, rgba(70,54,90,.12) 55%, rgba(70,54,90,0) 75%); filter:blur(2px); pointer-events:none; z-index:0; }
.living-spill { transition: opacity .5s ease; z-index:1; }
.living-screen { transition: opacity .45s ease; box-shadow: inset 0 0 8px rgba(255,255,255,.25); }
.living-focus { transition: transform .3s ease, filter .3s ease; }
.living-focus-on { transform: scale(1.16) translateY(-4%); filter: drop-shadow(0 10px 16px rgba(70,54,90,.35)); z-index: 80 !important; }
.living-hotspot { background: transparent; border: 0; padding: 0; z-index: 5; }
.living-hotspot-debug { outline: 2px dashed rgba(61,112,104,.9); background: rgba(61,112,104,.12); }
.living-hotspot-debug-off { outline: 2px dotted rgba(70,54,90,.4); background: rgba(70,54,90,.06); }
.living-hotspot > span { position:absolute; inset:0; border-radius:inherit; }
@keyframes living-hotspot-pulse { 0%{ box-shadow: 0 0 0 0 rgba(255,197,92,.6); } 100%{ box-shadow: 0 0 0 14px rgba(255,197,92,0); } }
.living-hotspot-pulse { animation: living-hotspot-pulse .6s ease-out 1; }
@keyframes living-breathe { 0%,100%{ transform: translateY(0) scaleY(1); } 50%{ transform: translateY(-0.5%) scaleY(1.012); } }
.living-avatar { animation: living-breathe 4.2s ease-in-out infinite; }
@keyframes living-greet { 0%{ transform: rotate(0); } 20%{ transform: rotate(-3deg); } 45%{ transform: rotate(2.4deg); } 70%{ transform: rotate(-1.4deg); } 100%{ transform: rotate(0); } }
.living-avatar-tap { animation: living-greet .9s ease-in-out 1, living-breathe 4.2s ease-in-out infinite .9s; }
@keyframes living-sway { 0%,100%{ transform: rotate(-1.1deg); } 50%{ transform: rotate(1.1deg); } }
.living-leaf { animation: living-sway 5.5s ease-in-out infinite; }
@keyframes living-sway-tap { 0%{ transform: rotate(0); } 22%{ transform: rotate(-3.4deg); } 50%{ transform: rotate(2.6deg); } 76%{ transform: rotate(-1.5deg); } 100%{ transform: rotate(0); } }
.living-leaf-tap { animation: living-sway-tap .85s ease-in-out 1, living-sway 5.5s ease-in-out infinite .85s; }
@keyframes living-sheet-up { from{ transform: translateY(10px); opacity:.3; } to{ transform: translateY(0); opacity:1; } }
.living-sheet { animation: living-sheet-up .24s ease; }
@media (prefers-reduced-motion: reduce) {
  .living-ambience, .living-dim, .living-spill, .living-screen, .living-focus { transition: none; }
  .living-avatar, .living-avatar-tap, .living-leaf, .living-leaf-tap, .living-sheet, .living-hotspot-pulse { animation: none; }
}
`;
