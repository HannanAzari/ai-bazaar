"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ExternalLink, Link as LinkIcon, Maximize2, Minimize2, Pause, Play, X } from "lucide-react";
import { LAYER } from "@/lib/nest-layers";
import { playerCommand, type PlayerTrack } from "@/lib/nest-player";

// ── M27B-3B — the Nestudio media player ──────────────────────────────────────
//
// ONE COMPONENT, TWO LAYOUTS, ONE IFRAME.
//
// The mini bar and the expanded surface are not two components. They are the same element
// tree with different classes, which is the whole reason expanding does not restart the
// video: React reconciles the <iframe> by its POSITION in the tree, so as long as that
// position is identical in both layouts the element is never unmounted and the provider
// never reloads. Two components — or the same component behind a ternary — would remount it,
// and "expand" would silently mean "start again from zero".
//
// It is rendered through a PORTAL to <body> for the foreground contract (§7). The runtime is
// mounted inside stacking contexts it does not control — the visitor page wraps it in `z-0`,
// the feed card wraps it in a <Link> — so a z-index applied in place would be trapped
// beneath that ancestor and the engagement rail would sit on top of the player's controls.
// A portal leaves those contexts entirely, and `LAYER.modal` then means what it says.
// This is the alternative to the `z-[9999]` the brief rules out.
//
// ── WHAT IT DELIBERATELY DOES NOT OWN ────────────────────────────────────────
//
// No playlist. No object state. No camera. Every one of those belongs to the runtime, and
// the player only calls back. That is what makes §6 (open and close preserve the room)
// true because there is no code here that could break it, rather than true because it was
// tested once.

export type NestMediaPlayerProps = {
  track: PlayerTrack;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onStop: () => void;
  onStep: (direction: 1 | -1) => void;
};

/** The mini bar's height. ~60px sits inside the brief's 56–64px target. */
const MINI_HEIGHT = 60;

export function NestMediaPlayer({ track, expanded, onExpand, onCollapse, onStop, onStep }: NestMediaPlayerProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── Where the bottom edge actually is ──────────────────────────────────────
  //
  // §2 — the player must clear the app's bottom navigation, and the runtime is mounted on
  // surfaces that have one (the feed) and surfaces that do not (the visitor Nest, the editor
  // Preview). Rather than add a prop each of those has to remember to pass — and get wrong
  // once — the nav is MEASURED. `nav[aria-label="Primary"]` is the app shell's own semantic
  // marker, and a page without it simply reports zero.
  const [navHeight, setNavHeight] = useState(0);
  useEffect(() => {
    const measure = () => {
      const nav = window.document.querySelector('nav[aria-label="Primary"]');
      setNavHeight(nav ? Math.round(nav.getBoundingClientRect().height) : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  // The visitor's INTENT, not a report from the provider — see `playerCommand`. Starts true
  // because the second tap on the object is itself the request to play.
  const [playing, setPlaying] = useState(true);

  // A new track means a new video: the still comes back until the frame reports `load`, so a
  // visitor never watches the previous item's last frame while the next one buffers (§4).
  useEffect(() => {
    setReady(false);
    setPlaying(true);
  }, [track.providerId]);

  const toggle = useCallback(() => {
    const next = !playing;
    setPlaying(next);
    // Fire-and-forget by design: the frame is cross-origin, so there is no reply to await.
    frameRef.current?.contentWindow?.postMessage(playerCommand(next ? "play" : "pause"), "*");
  }, [playing]);

  // Escape collapses, then stops — the same two steps as the visible controls, in the same
  // order, so the keyboard cannot reach a state the buttons cannot.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (expanded) onCollapse();
      else onStop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, onCollapse, onStop]);

  if (!mounted) return null;

  const multi = track.count > 1;
  const bottom = navHeight ? `${navHeight + 10}px` : "max(env(safe-area-inset-bottom), 12px)";

  const node = (
    <div
      data-nest-player=""
      data-player-expanded={expanded ? "" : undefined}
      className="pointer-events-none fixed inset-0"
      // `LAYER.player`, not a local number. It is above `LAYER.editor` because the editor's
      // Preview is a full-screen shell the player must be reachable from — the one case a
      // portal alone does not solve: the portal escapes the stacking CONTEXT, but it still
      // has to win on VALUE against another fixed child of <body>.
      style={{ zIndex: LAYER.player }}
    >
      {/* ── The room behind, dimmed rather than replaced (§3) ────────────────
          Only when expanded. Collapsed, the Nest stays fully live underneath and the bar is
          the only thing that takes a pointer. */}
      <div
        aria-hidden={!expanded}
        onPointerDown={(e) => { e.stopPropagation(); if (expanded) onCollapse(); }}
        className={`absolute inset-0 backdrop-blur-md transition-opacity duration-300 motion-reduce:transition-none ${
          expanded ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        // Inline, not `bg-[#0d0c10]/72`: that class produced `rgba(0,0,0,0)` at runtime —
        // the blur landed and the dim silently did not, leaving the room bright behind the
        // player instead of receding. Measured with `getComputedStyle`, which is the only
        // way this class of failure is ever visible.
        style={{ backgroundColor: "rgba(13, 12, 16, 0.72)" }}
      />

      <div
        role={expanded ? "dialog" : undefined}
        aria-modal={expanded ? true : undefined}
        aria-label={expanded ? `${track.title} — ${track.provider}` : undefined}
        // Every pointer event stops here. Without this the runtime's own listener would see
        // a control press as a gesture in the room behind the player (§7 — no click-through).
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        className={`pointer-events-auto absolute overflow-hidden border border-white/10 bg-[#17161b]/95 text-white shadow-[0_24px_60px_-18px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-[border-radius] duration-300 motion-reduce:transition-none ${
          expanded ? "rounded-[26px]" : "rounded-2xl"
        }`}
        style={
          expanded
            ? { left: 12, right: 12, bottom, maxWidth: 436, marginInline: "auto", padding: 12 }
            : { left: 12, right: 12, bottom, maxWidth: 436, marginInline: "auto", height: MINI_HEIGHT }
        }
      >
        <div className={expanded ? "flex flex-col gap-3" : "flex h-full items-center gap-3 pl-2 pr-2.5"}>
          {/* ── The media box ─────────────────────────────────────────────────
              This element and its <iframe> child keep the SAME position in the tree in both
              layouts. Only the box changes size, so the video plays continuously across
              expand and collapse. */}
          <div
            data-player-stage={expanded ? "expanded" : "mini"}
            className={`relative shrink-0 overflow-hidden bg-black ${
              expanded ? "aspect-video w-full rounded-2xl" : "size-11 rounded-xl"
            }`}
          >
            {track.embedUrl ? (
              <iframe
                ref={frameRef}
                key={track.providerId ?? "none"}
                src={track.embedUrl}
                title={track.title}
                className="absolute inset-0 size-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => setReady(true)}
              />
            ) : null}

            {/* §4 — the still, and the only loading state. It covers the frame until the
                provider reports `load`, and stays forever for an item that cannot be
                embedded, so there is never an empty black rectangle. Collapsed it stays up
                on purpose: a 44px video is not something anyone is watching, and the
                artwork is what makes the bar legible at a glance. */}
            {track.thumbnailUrl && (!ready || !expanded) ? (
              /* eslint-disable-next-line @next/next/no-img-element -- provider still */
              <img
                src={track.thumbnailUrl}
                alt=""
                className="absolute inset-0 size-full object-cover"
              />
            ) : !track.embedUrl ? (
              // Not every connected item is a video. A pasted link has no artwork at all, and
              // an empty black square in the bar reads as a broken thumbnail rather than as
              // "this one is a link" — found by connecting real URLs, which Connect
              // classified as `website` rather than the images they turned out to be.
              <span className="absolute inset-0 grid place-items-center bg-white/[0.06] text-white/35">
                <LinkIcon className={expanded ? "size-8" : "size-4"} />
              </span>
            ) : null}
            {expanded && !ready && track.embedUrl ? (
              <span className="absolute inset-0 grid place-items-center bg-black/45">
                <span className="size-7 animate-spin rounded-full border-2 border-white/25 border-t-white/85" />
              </span>
            ) : null}
          </div>

          {/* ── Title + provider ──────────────────────────────────────────── */}
          <div className={expanded ? "min-w-0 px-1" : "min-w-0 flex-1"}>
            <p className={`truncate font-black leading-tight ${expanded ? "text-[17px]" : "text-[13px]"}`}>{track.title}</p>
            <p className={`truncate font-bold text-white/45 ${expanded ? "mt-0.5 text-xs" : "text-[11px]"}`}>
              {track.provider}
              {multi ? <span className="text-white/30"> · {track.index + 1}/{track.count}</span> : null}
            </p>
          </div>

          {/* ── Controls ──────────────────────────────────────────────────── */}
          <div className={expanded ? "flex items-center justify-between gap-2 px-1 pb-0.5" : "flex flex-none items-center gap-0.5"}>
            <div className={expanded ? "flex flex-1 items-center justify-center gap-2" : "flex items-center gap-0.5"}>
              {/* Previous/Next exist only for an actual playlist (§2). A disabled arrow on a
                  single item is chrome that teaches the visitor nothing. */}
              {multi ? (
                <PlayerButton label="Previous" onClick={() => onStep(-1)} big={expanded}>
                  <ChevronLeft className={expanded ? "size-6" : "size-[18px]"} />
                </PlayerButton>
              ) : null}
              {track.canControl ? (
                <PlayerButton label={playing ? "Pause" : "Play"} onClick={toggle} big={expanded} accent={expanded}>
                  {playing ? <Pause className={expanded ? "size-6" : "size-[18px]"} /> : <Play className={expanded ? "size-6" : "size-[18px]"} />}
                </PlayerButton>
              ) : null}
              {multi ? (
                <PlayerButton label="Next" onClick={() => onStep(1)} big={expanded}>
                  <ChevronRight className={expanded ? "size-6" : "size-[18px]"} />
                </PlayerButton>
              ) : null}
            </div>

            <div className={expanded ? "flex items-center gap-1" : "flex items-center gap-0.5"}>
              {expanded && track.externalUrl ? (
                // Secondary, and only ever secondary (§4): leaving Nestudio is a choice the
                // visitor makes, never a fallback the player takes for them.
                <a
                  href={track.externalUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  // "Open in Link" is not a sentence. Named providers get "Open in YouTube";
                  // a plain URL gets the plain phrasing.
                  aria-label={track.providerId ? `Open in ${track.provider}` : "Open link"}
                  className="grid size-10 touch-manipulation place-items-center rounded-full text-white/50 transition active:scale-95"
                >
                  <ExternalLink className="size-[18px]" />
                </a>
              ) : null}
              <PlayerButton label={expanded ? "Minimise" : "Expand"} onClick={expanded ? onCollapse : onExpand} big={expanded}>
                {expanded ? <Minimize2 className="size-[18px]" /> : <Maximize2 className="size-[18px]" />}
              </PlayerButton>
              {!expanded ? (
                <PlayerButton label="Stop" onClick={onStop}>
                  <X className="size-[18px]" />
                </PlayerButton>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(node, window.document.body);
}

function PlayerButton({
  label,
  onClick,
  children,
  big = false,
  accent = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  big?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`grid touch-manipulation place-items-center rounded-full transition active:scale-90 ${
        big ? "size-12" : "size-9"
      } ${accent ? "bg-white text-[#17161b]" : "text-white/75"}`}
    >
      {children}
    </button>
  );
}
