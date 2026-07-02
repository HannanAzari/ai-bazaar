"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, Link2, Smile, Trash2, Type, Upload, X } from "lucide-react";
import { MobileBottomSheet, type BottomSheetSnapPoint } from "@/components/nest/editor/mobile-bottom-sheet";
import type { EditableSurface, SurfaceContent, SurfaceTextVariant } from "@/lib/nest-surface-types";
import { SURFACE_TEXT_VARIANTS } from "@/lib/nest-surface-types";
import { addToSurfaceGallery, downscaleImageFile, loadSurfaceGallery } from "@/lib/nest-surface-gallery";

// ── Surface editor (M8, Phase 5) — local prototype only ──────────────────────
//
// Edits ONE surface's content: an image (upload / paste URL / local gallery), a text
// preset (title/quote/goal/slogan/note), or a sticker (emoji). No AI, no cloud upload —
// uploads become a downscaled data URL (kept small for localStorage) held in the document.
// Save applies the content, shows "Saved" and closes; Remove clears it.

const EMOJI = ["😀", "🎉", "❤️", "🔥", "⭐", "🌟", "📚", "🎧", "🎮", "☕", "🌈", "✨", "👍", "🚀", "🏆", "🌸", "🎨", "🐾"];

type Tab = "image" | "text" | "sticker";

export function SurfaceEditorSheet({
  surface,
  assetName,
  snap,
  onSnapChange,
  onCommit,
  onClose,
  onSaved,
}: {
  surface: EditableSurface;
  assetName: string;
  snap: BottomSheetSnapPoint;
  onSnapChange: (s: BottomSheetSnapPoint) => void;
  onCommit: (content: SurfaceContent | undefined) => void;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const accepts = surface.acceptedContentTypes;
  const canImage = accepts.includes("uploaded_image") || accepts.includes("url_thumbnail");
  const canText = accepts.includes("text");
  const canSticker = accepts.includes("emoji") || accepts.includes("sticker_asset");

  const [pending, setPending] = useState<SurfaceContent | undefined>(surface.content);
  const [tab, setTab] = useState<Tab>(
    surface.content?.kind === "text" ? "text" : surface.content?.kind === "sticker" ? "sticker" : canImage ? "image" : canText ? "text" : "sticker",
  );
  const [url, setUrl] = useState(surface.content?.kind === "image" && surface.content.source === "url" ? surface.content.src : "");
  const [busy, setBusy] = useState(false);
  // Small array read from localStorage; re-renders (upload/paste) naturally refresh it.
  const gallery = loadSurfaceGallery();
  const fileRef = useRef<HTMLInputElement>(null);

  const textVal = pending?.kind === "text" ? pending.text : "";
  const textVar: SurfaceTextVariant = (pending?.kind === "text" && pending.variant) || "quote";

  async function onFile(file: File) {
    setBusy(true);
    try {
      const src = await downscaleImageFile(file);
      addToSurfaceGallery(src);
      setPending({ kind: "image", src, source: "upload", fit: "cover" });
    } finally {
      setBusy(false);
    }
  }

  const save = () => {
    if (!pending) return;
    onCommit(pending);
    onSaved?.();
  };
  const remove = () => {
    onCommit(undefined);
    onSaved?.();
  };

  const header = (
    <div className="px-3 pb-1 pt-1">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-saffron">Surface</p>
          <h3 className="display truncate text-base leading-tight text-ink">{assetName} · {surface.name}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink/55 hover:bg-ink/5"><X className="h-5 w-5" /></button>
      </div>
    </div>
  );

  const TabBtn = ({ id, icon, label, show }: { id: Tab; icon: React.ReactNode; label: string; show: boolean }) =>
    show ? (
      <button type="button" onClick={() => setTab(id)} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold ${tab === id ? "border-saffron bg-saffron/15 text-ink" : "border-ink/15 text-ink/60"}`}>{icon} {label}</button>
    ) : null;

  return (
    <MobileBottomSheet open snap={snap} onSnapChange={onSnapChange} onClose={onClose} backdrop="none" label={`Edit ${surface.name}`} header={header}>
      <div className="px-3 pb-4 pt-1">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <TabBtn id="image" icon={<ImageIcon className="h-3.5 w-3.5" />} label="Image" show={canImage} />
          <TabBtn id="text" icon={<Type className="h-3.5 w-3.5" />} label="Text" show={canText} />
          <TabBtn id="sticker" icon={<Smile className="h-3.5 w-3.5" />} label="Sticker" show={canSticker} />
        </div>

        {tab === "image" && canImage ? (
          <div className="space-y-2.5">
            <div className="flex gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-parchment hover:bg-ink/85 disabled:opacity-50"><Upload className="h-3.5 w-3.5" /> {busy ? "Loading…" : "Upload image"}</button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} />
            </div>
            <label className="block">
              <span className="text-[9px] font-bold uppercase tracking-wide text-ink/45">Paste image URL</span>
              <div className="mt-0.5 flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
                  <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/photo.jpg" inputMode="url" style={{ fontSize: 16 }} className="w-full rounded-lg border border-ink/15 bg-white/80 py-2 pl-7 pr-2 text-ink focus:border-saffron focus:outline-none" />
                </div>
                <button type="button" onClick={() => url.trim() && setPending({ kind: "image", src: url.trim(), source: "url", fit: "cover" })} className="rounded-full border border-ink/20 px-3 py-1.5 text-xs font-bold text-ink/70 hover:border-saffron">Use</button>
              </div>
            </label>
            {gallery.length ? (
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wide text-ink/45">Recent</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {gallery.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <button key={i} type="button" onClick={() => setPending({ kind: "image", src, source: "gallery", fit: "cover" })} className="h-12 w-12 overflow-hidden rounded-lg border border-ink/15"><img src={src} alt="" className="h-full w-full object-cover" /></button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "text" && canText ? (
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {SURFACE_TEXT_VARIANTS.map((v) => (
                <button key={v} type="button" onClick={() => setPending({ kind: "text", text: textVal, variant: v })} className={`rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${textVar === v ? "border-saffron bg-saffron/15 text-ink" : "border-ink/15 text-ink/60"}`}>{v}</button>
              ))}
            </div>
            <textarea value={textVal} onChange={(e) => setPending({ kind: "text", text: e.target.value, variant: textVar })} placeholder="Your quote, goal or note…" rows={3} style={{ fontSize: 16 }} className="w-full resize-none rounded-lg border border-ink/15 bg-white/80 p-2 text-ink focus:border-saffron focus:outline-none" />
          </div>
        ) : null}

        {tab === "sticker" && canSticker ? (
          <div className="grid grid-cols-8 gap-1">
            {EMOJI.map((e) => (
              <button key={e} type="button" onClick={() => setPending({ kind: "sticker", emoji: e })} className={`flex h-9 items-center justify-center rounded-lg border text-lg ${pending?.kind === "sticker" && pending.emoji === e ? "border-saffron bg-saffron/15" : "border-ink/10"}`}>{e}</button>
            ))}
          </div>
        ) : null}

        {/* Preview */}
        {pending ? (
          <div className="mt-3 rounded-xl border border-ink/10 bg-white/40 p-2">
            <span className="text-[9px] font-bold uppercase tracking-wide text-ink/45">Preview</span>
            <div className="mt-1 flex h-20 items-center justify-center overflow-hidden rounded-lg bg-ink/5">
              {pending.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pending.src} alt="" className="h-full w-full object-contain" />
              ) : pending.kind === "sticker" ? (
                <span className="text-4xl">{pending.emoji}</span>
              ) : (
                <span className="px-3 text-center text-sm font-semibold text-ink">{pending.text || "…"}</span>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={save} disabled={!pending || (pending.kind === "text" && !pending.text.trim())} className="inline-flex items-center gap-1 rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-parchment hover:bg-ink/85 disabled:opacity-50">Save</button>
          {surface.content ? <button type="button" onClick={remove} className="inline-flex items-center gap-1 rounded-full border border-terracotta/40 px-3 py-1.5 text-xs font-bold text-terracotta hover:bg-terracotta/10"><Trash2 className="h-3.5 w-3.5" /> Remove</button> : null}
        </div>
      </div>
    </MobileBottomSheet>
  );
}
