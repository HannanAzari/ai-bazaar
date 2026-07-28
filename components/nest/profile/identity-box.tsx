"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Avatar } from "@/components/nest/app-shell/profile-summary";
import { CenteredModal } from "@/components/nest/profile/modal";
import { formatCount } from "@/lib/nest-engagement";

// Day 3.3 — ONE compact, expandable identity box. The public profile and the creator's own
// profile render the SAME component; only `action` (Follow vs owner edit) differs. Identity
// appears here and nowhere else on these surfaces.
//
// Collapsed: avatar · name · @username · one-line bio · followers · Links control · action.
// Expanded: full bio · all links · collapse control.

export type IdentityLink = { label: string; href: string };

// One quiet metric — no card, no container, just weighted text.
function Metric({ value, one, many }: { value: number; one: string; many: string }) {
  return (
    <>
      <span className="font-bold text-ink/60">{formatCount(value)}</span> {value === 1 ? one : many}
    </>
  );
}

export function IdentityBox({
  username,
  displayName,
  bio,
  avatarUrl,
  followers,
  nests = 0,
  views = 0,
  links = [],
  action,
  onAvatarClick,
  avatarLabel,
}: {
  username?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string | null;
  followers: number;
  /** M20 — quiet three-metric row, identical on creator + visitor. */
  nests?: number;
  views?: number;
  links?: IdentityLink[];
  /** Follow (public) or the owner's edit control. */
  action?: React.ReactNode;
  /** Owner only — tapping the avatar creates/changes it. */
  onAvatarClick?: () => void;
  avatarLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);
  const [bioClamped, setBioClamped] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const bioRef = useRef<HTMLParagraphElement>(null);
  const name = displayName ?? (username ? `@${username}` : "A Nestudio creator");
  const hasLinks = links.length > 0;

  // Only offer "More" when the bio actually overflows two lines — measured, not guessed.
  useEffect(() => {
    const el = bioRef.current;
    if (!el || !bio) { setBioClamped(false); return; }
    const check = () => setBioClamped(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [bio, bioOpen]);

  // Close the links overlay on outside tap / Escape. (Navigating away unmounts the box.)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // Visitors may tap an EXISTING avatar to see it larger. An empty placeholder does nothing,
  // so nobody taps into a misleading editor.
  const canPreview = !onAvatarClick && Boolean(avatarUrl);

  return (
    /* `relative z-30`: backdrop-blur makes this card its own stacking context, so without an
       explicit z-index the later house sibling paints over the links popover. */
    <section className="relative z-30 rounded-2xl border border-timber/15 bg-white/90 px-3.5 py-3 shadow-soft backdrop-blur">
      <div className="flex items-center gap-3">
        {onAvatarClick ? (
          <button onClick={onAvatarClick} aria-label={avatarLabel ?? "Change profile photo"} className="shrink-0 rounded-full active:scale-95">
            <Avatar username={username} src={avatarUrl} size={44} />
          </button>
        ) : canPreview ? (
          <button onClick={() => setPreview(true)} aria-label={`View ${name}'s avatar`} className="shrink-0 rounded-full active:scale-95">
            <Avatar username={username} src={avatarUrl} size={44} />
          </button>
        ) : (
          <Avatar username={username} src={avatarUrl} size={44} />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-black leading-tight text-ink">{name}</p>
          {username ? <p className="truncate text-xs text-ink/50">@{username}</p> : null}
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {/* Bio — up to 2 lines, then "More ▾" grows the card in place. No modal, no navigation.
          Visitors and creators behave identically; nobody loses information to a "…". */}
      {bio ? (
        <div className="mt-2">
          <p
            ref={bioRef}
            className={`text-[13px] leading-snug text-ink/70 transition-all duration-200 ${bioOpen ? "" : "line-clamp-2"}`}
          >
            {bio}
          </p>
          {bioClamped || bioOpen ? (
            <button
              onClick={() => setBioOpen((o) => !o)}
              aria-expanded={bioOpen}
              className="mt-0.5 inline-flex min-h-[28px] items-center gap-0.5 text-[11px] font-bold text-ink/50 active:scale-95"
            >
              {bioOpen ? "Less" : "More"}
              <ChevronDown className={`size-3 transition-transform ${bioOpen ? "rotate-180" : ""}`} />
            </button>
          ) : null}
        </div>
      ) : null}

      {/* quiet metadata row + the links control (opens an overlay, never reflows) */}
      <div className="mt-2 flex items-center gap-3">
        <p className="truncate text-[11px] text-ink/45">
          <Metric value={nests} one="Nest" many="Nests" />
          {" · "}
          <Metric value={views} one="View" many="Views" />
          {" · "}
          <Metric value={followers} one="Follower" many="Followers" />
        </p>
        {hasLinks ? (
          <div ref={wrap} className="relative ml-auto">
            <button
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-haspopup="menu"
              aria-label={open ? "Hide links" : "Show links"}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-full px-2 text-[11px] font-bold text-ink/55 active:scale-95"
            >
              Links <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {/* Anchored popover — absolutely positioned, so it floats over the house scene
                without resizing this card or moving anything below it. */}
            {open ? (
              <div
                role="menu"
                className="pop-in absolute right-0 top-full z-40 mt-2 w-max min-w-[168px] max-w-[240px] rounded-2xl border border-timber/15 bg-white p-2 shadow-lift"
              >
                <style>{`@keyframes pop-in { from { opacity: 0; transform: translateY(-4px) scale(.98) } to { opacity: 1; transform: none } } .pop-in { animation: pop-in .16s ease-out both } @media (prefers-reduced-motion: reduce) { .pop-in { animation: none } }`}</style>
                <div className="flex flex-col gap-1">
                  {links.map((l) => (
                    <a
                      key={l.label}
                      href={l.href}
                      target="_blank"
                      rel="noreferrer"
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className="inline-flex min-h-[36px] items-center justify-between gap-2 rounded-xl px-2.5 text-[12px] font-bold text-ink/75 hover:bg-parchment"
                    >
                      {l.label} <span aria-hidden className="text-ink/35">↗</span>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* visitor preview — the avatar, larger, on a blurred backdrop. No edit controls. */}
      {canPreview ? (
        <CenteredModal open={preview} onClose={() => setPreview(false)} title={`${name}'s avatar`} tone="dark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarUrl ?? undefined} alt={`${name}'s avatar`} className="mx-auto max-h-[62vh] w-full rounded-3xl object-contain" />
        </CenteredModal>
      ) : null}
    </section>
  );
}
