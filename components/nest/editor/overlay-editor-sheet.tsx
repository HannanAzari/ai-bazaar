"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { MobileBottomSheet, type BottomSheetSnapPoint } from "@/components/nest/editor/mobile-bottom-sheet";
import { downscaleImageFile } from "@/lib/nest-surface-gallery";
import type { NestOverlay } from "@/lib/nest-editor-types";

// ── Overlay editor (M13 · Task 4B) — local prototype only ────────────────────
//
// Edits ONE generic overlay (a text or image "sticker"). Text: content + colour + align.
// Image: replace + fit. Move/resize/rotate happen on the canvas (Arrange); this sheet only
// owns the content. Uploads become a downscaled data URL held in the document (no cloud).

const COLORS = ["#38291d", "#ffffff", "#a65b3f", "#4d7358", "#d9913c", "#46365a", "#5d93ac"];
const ALIGNS: NonNullable<Extract<NestOverlay, { kind: "text" }>["align"]>[] = ["left", "center", "right"];

export function OverlayEditorSheet({
  overlay,
  snap,
  onSnapChange,
  onChange,
  onClose,
  onSaved,
}: {
  overlay: NestOverlay;
  snap: BottomSheetSnapPoint;
  onSnapChange: (s: BottomSheetSnapPoint) => void;
  onChange: (overlay: NestOverlay) => void;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setBusy(true);
    try {
      const src = await downscaleImageFile(file);
      onChange({ kind: "image", src, fit: overlay.kind === "image" ? overlay.fit ?? "contain" : "contain" });
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <div className="px-3 pb-1 pt-1">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-saffron">Sticker</p>
          <h3 className="display truncate text-base leading-tight text-ink">{overlay.kind === "text" ? "Text sticker" : "Image sticker"}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink/55 hover:bg-ink/5"><X className="h-5 w-5" /></button>
      </div>
    </div>
  );

  return (
    <MobileBottomSheet open snap={snap} onSnapChange={onSnapChange} onClose={onClose} backdrop="none" label="Edit sticker" header={header}>
      <div className="px-3 pb-4 pt-1">
        {overlay.kind === "text" ? (
          <div className="space-y-3">
            <textarea
              value={overlay.text}
              onChange={(e) => onChange({ ...overlay, text: e.target.value })}
              placeholder="Your text…"
              rows={2}
              style={{ fontSize: 16 }}
              className="w-full resize-none rounded-lg border border-ink/15 bg-white/80 p-2 text-ink focus:border-saffron focus:outline-none"
            />
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wide text-ink/45">Colour</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => onChange({ ...overlay, color: c })} className={`h-7 w-7 rounded-full border ${overlay.color === c ? "ring-2 ring-saffron ring-offset-1" : "border-ink/15"}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wide text-ink/45">Align</span>
              <div className="mt-1 flex gap-1.5">
                {ALIGNS.map((a) => (
                  <button key={a} type="button" onClick={() => onChange({ ...overlay, align: a })} className={`rounded-full border px-3 py-1 text-[11px] font-bold capitalize ${(overlay.align ?? "center") === a ? "border-saffron bg-saffron/15 text-ink" : "border-ink/15 text-ink/60"}`}>{a}</button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-parchment hover:bg-ink/85 disabled:opacity-50"><Upload className="h-3.5 w-3.5" /> {busy ? "Loading…" : "Replace image"}</button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} />
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wide text-ink/45">Fit</span>
              <div className="mt-1 flex gap-1.5">
                {(["contain", "cover"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => onChange({ ...overlay, fit: f })} className={`rounded-full border px-3 py-1 text-[11px] font-bold capitalize ${(overlay.fit ?? "contain") === f ? "border-saffron bg-saffron/15 text-ink" : "border-ink/15 text-ink/60"}`}>{f}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onSaved?.()} className="inline-flex items-center gap-1 rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-parchment hover:bg-ink/85">Done</button>
        </div>
      </div>
    </MobileBottomSheet>
  );
}
