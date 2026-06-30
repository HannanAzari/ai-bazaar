"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, ExternalLink, Lock, LogIn, Pencil, Plus, RotateCcw, Trash2, Unlock } from "lucide-react";
import type { FocusTransition, FocusTrigger, NestDetailScene, NestFocusArea } from "@/lib/nest-focus-types";
import { FOCUS_TRANSITIONS, FOCUS_TRIGGERS } from "@/lib/nest-focus-types";
import { MobileBottomSheet, type BottomSheetSnapPoint } from "@/components/nest/editor/mobile-bottom-sheet";
import { EDITOR_LAYERS } from "@/lib/nest-editor-layers";

// Compact Focus authoring sheet (M7C.5). Creator mode is intentionally minimal: chips for
// existing areas · Add · the selected area's name (inline rename) · Preview · Delete. The
// room stays visible. Enabled / Lock / Reset / Hint / trigger / transition / detail-scene
// are TEMPLATE/INTERNAL-only (advanced). The drawer sits at the `drawer` layer so the
// canvas focus overlay can never paint above it.

export function FocusSheet({
  focusAreas,
  selectedFocusId,
  scenesById,
  advanced,
  snap,
  onSnapChange,
  onClose,
  onSelectFocus,
  onAddFocus,
  onPatch,
  onDelete,
  onCreateScene,
  onOpenScene,
  onEnterArea,
  onReset,
}: {
  focusAreas: NestFocusArea[];
  selectedFocusId?: string;
  scenesById: Record<string, NestDetailScene>;
  advanced: boolean;
  snap: BottomSheetSnapPoint;
  onSnapChange: (s: BottomSheetSnapPoint) => void;
  onClose: () => void;
  onSelectFocus: (id?: string) => void;
  onAddFocus: () => void;
  onPatch: (patch: Partial<NestFocusArea>) => void;
  onDelete: () => void;
  onCreateScene: () => void;
  onOpenScene: (sceneId: string) => void;
  onEnterArea?: () => void;
  onReset?: () => void;
}) {
  const selected = focusAreas.find((f) => f.id === selectedFocusId);
  const linkedScene = selected?.targetSceneId ? scenesById[selected.targetSceneId] : undefined;

  // Inline rename (no permanent large input).
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  useEffect(() => { setRenaming(false); }, [selectedFocusId]);
  const startRename = () => { setDraft(selected?.name ?? ""); setRenaming(true); };
  const commitRename = () => {
    const name = draft.trim() || selected?.name || "Focus area";
    onPatch({ name, previewHint: `Explore ${name}` });
    setRenaming(false);
  };

  const header = (
    <div className="px-3 pb-1 pt-1">
      <div className="flex items-center justify-between">
        <h3 className="display text-base leading-tight text-ink">Focus areas</h3>
        <button type="button" onClick={onClose} aria-label="Close focus" className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 text-ink/55 hover:bg-ink/5">✕</button>
      </div>
    </div>
  );

  return (
    <MobileBottomSheet
      open
      snap={snap}
      onSnapChange={onSnapChange}
      onClose={onClose}
      backdrop="none"
      label="Focus areas"
      header={header}
      sheetZIndex={EDITOR_LAYERS.drawer}
      backdropZIndex={EDITOR_LAYERS.drawerBackdrop}
    >
      <div className="px-3 pb-3 pt-1">
        {/* Existing areas — horizontally scrollable chips. */}
        {focusAreas.length === 0 ? (
          <p className="mb-2 text-xs text-ink/55">Add an area visitors can tap to zoom into — the frame, the TV, the bookshelf.</p>
        ) : (
          <div className="-mx-3 mb-2 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {focusAreas.map((f) => (
              <button key={f.id} type="button" onClick={() => onSelectFocus(f.id)} className={`shrink-0 rounded-full border px-2.5 py-1.5 text-xs font-bold transition ${f.id === selectedFocusId ? "border-cobalt bg-cobalt/10 text-ink" : "border-ink/15 text-ink/65 hover:border-ink/30"}`}>
                {f.name}
              </button>
            ))}
          </div>
        )}

        <button type="button" onClick={onAddFocus} className="mb-2 inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-bold text-ink/70 hover:border-cobalt"><Plus className="h-3.5 w-3.5" /> Add area</button>

        {selected ? (
          <div className="space-y-2 rounded-2xl border border-ink/10 bg-white/50 p-2.5">
            {/* Selected name + inline rename */}
            {renaming ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(false); }}
                className="w-full rounded-lg border border-cobalt bg-white/90 py-1.5 px-2 text-sm font-bold text-ink outline-none"
                aria-label="Rename focus area"
              />
            ) : (
              <button type="button" onClick={startRename} className="flex w-full items-center justify-between gap-2 text-left">
                <span className="text-sm font-bold text-ink">{selected.name}</span>
                <Pencil className="h-3.5 w-3.5 shrink-0 text-ink/40" />
              </button>
            )}

            {/* Primary actions — Enter is the main action (opens the editable child scene). */}
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={onEnterArea} aria-label="Enter focus area" className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-ink px-3 py-2 text-xs font-bold text-parchment hover:bg-ink/85"><LogIn className="h-3.5 w-3.5" /> Enter</button>
              <button type="button" onClick={onDelete} className="inline-flex items-center justify-center gap-1 rounded-full border border-terracotta/40 px-3 py-2 text-xs font-bold text-terracotta hover:bg-terracotta/10"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
            </div>

            {/* ── Template / Internal only (advanced) ── */}
            {advanced ? (
              <div className="space-y-2 border-t border-ink/10 pt-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-ink/40">Template / internal</p>
                <label className="block">
                  <span className="text-[9px] font-bold uppercase tracking-wide text-ink/45">Visitor hint</span>
                  <input value={selected.previewHint ?? ""} onChange={(e) => onPatch({ previewHint: e.target.value })} placeholder={`Explore ${selected.name}`} className="mt-0.5 w-full rounded-lg border border-ink/15 bg-white/80 py-1.5 px-2 text-sm text-ink focus:border-cobalt focus:outline-none" />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[9px] font-bold uppercase tracking-wide text-ink/45">Entry</span>
                    <select value={selected.trigger} onChange={(e) => onPatch({ trigger: e.target.value as FocusTrigger })} className="mt-0.5 w-full rounded-lg border border-ink/15 bg-white/70 py-1.5 px-2 text-xs text-ink focus:border-cobalt focus:outline-none">
                      {FOCUS_TRIGGERS.map((t) => <option key={t} value={t}>{t === "double_tap" ? "double tap" : t}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[9px] font-bold uppercase tracking-wide text-ink/45">Transition</span>
                    <select value={selected.transition} onChange={(e) => onPatch({ transition: e.target.value as FocusTransition })} className="mt-0.5 w-full rounded-lg border border-ink/15 bg-white/70 py-1.5 px-2 text-xs text-ink focus:border-cobalt focus:outline-none">
                      {FOCUS_TRANSITIONS.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => onPatch({ enabled: !selected.enabled })} aria-pressed={!selected.enabled} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold ${selected.enabled ? "border-ink/15 text-ink/60" : "border-terracotta text-terracotta"}`}>{selected.enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />} {selected.enabled ? "Enabled" : "Disabled"}</button>
                  <button type="button" onClick={() => onPatch({ locked: !selected.locked })} aria-pressed={selected.locked} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold ${selected.locked ? "border-terracotta text-terracotta" : "border-ink/15 text-ink/60"}`}>{selected.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />} {selected.locked ? "Locked" : "Lock"}</button>
                  <button type="button" onClick={onReset} className="inline-flex items-center gap-1 rounded-md border border-ink/15 px-2 py-1 text-[10px] font-bold text-ink/60 hover:border-cobalt"><RotateCcw className="h-3 w-3" /> Reset</button>
                </div>
                {linkedScene ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-meadow/10 px-2.5 py-2">
                    <span className="text-[11px] font-bold text-meadow-shade">Detail surface: {linkedScene.name}</span>
                    <button type="button" onClick={() => onOpenScene(linkedScene.id)} className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-[11px] font-bold text-parchment hover:bg-ink/85"><ExternalLink className="h-3 w-3" /> Edit scene</button>
                  </div>
                ) : (
                  <button type="button" onClick={onCreateScene} className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-[11px] font-bold text-ink/60 hover:border-cobalt"><Plus className="h-3 w-3" /> Open a detailed surface instead</button>
                )}
              </div>
            ) : null}
          </div>
        ) : focusAreas.length ? (
          <p className="text-xs text-ink/45">Tap an area chip (or the rectangle on the Nest) to edit it.</p>
        ) : null}
      </div>
    </MobileBottomSheet>
  );
}
