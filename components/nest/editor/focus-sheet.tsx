"use client";

import { Circle, ExternalLink, Eye, EyeOff, Lock, Plus, Square, Trash2, Unlock } from "lucide-react";
import type { FocusTransition, FocusTrigger, NestDetailScene, NestFocusArea } from "@/lib/nest-focus-types";
import { FOCUS_TRANSITIONS, FOCUS_TRIGGERS } from "@/lib/nest-focus-types";
import { MobileBottomSheet, type BottomSheetSnapPoint } from "@/components/nest/editor/mobile-bottom-sheet";

// The Focus authoring bottom sheet (M7C). Normal creators get a guided flow — add an
// area, name it, create/open its detail scene. Template authors (advanced) also see the
// entry trigger, transition style, and exact geometry. Reuses the shared bottom sheet.

export function FocusSheet({
  focusAreas,
  selectedFocusId,
  scenesById,
  advanced,
  snap,
  onSnapChange,
  onClose,
  onSelectFocus,
  onAddRect,
  onAddEllipse,
  onPatch,
  onDelete,
  onCreateScene,
  onOpenScene,
}: {
  focusAreas: NestFocusArea[];
  selectedFocusId?: string;
  scenesById: Record<string, NestDetailScene>;
  advanced: boolean;
  snap: BottomSheetSnapPoint;
  onSnapChange: (s: BottomSheetSnapPoint) => void;
  onClose: () => void;
  onSelectFocus: (id?: string) => void;
  onAddRect: () => void;
  onAddEllipse: () => void;
  onPatch: (patch: Partial<NestFocusArea>) => void;
  onDelete: () => void;
  onCreateScene: () => void;
  onOpenScene: (sceneId: string) => void;
}) {
  const selected = focusAreas.find((f) => f.id === selectedFocusId);
  const linkedScene = selected?.targetSceneId ? scenesById[selected.targetSceneId] : undefined;

  const header = (
    <div className="px-3 pb-1 pt-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-cobalt">Focus</p>
          <h3 className="display text-base leading-tight text-ink">Explorable areas</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close focus" className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink/55 hover:bg-ink/5">✕</button>
      </div>
    </div>
  );

  return (
    <MobileBottomSheet open snap={snap} onSnapChange={onSnapChange} onClose={onClose} backdrop="none" label="Focus areas" header={header}>
      <div className="px-3 pb-4 pt-1">
        {/* Guided action for normal creators */}
        {focusAreas.length === 0 ? (
          <p className="mb-3 text-xs text-ink/55">Select an area visitors can explore — add a region over the desk, a shelf, or a display, then link it to a detail scene.</p>
        ) : (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {focusAreas.map((f) => (
              <button key={f.id} type="button" onClick={() => onSelectFocus(f.id)} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold transition ${f.id === selectedFocusId ? "border-cobalt bg-cobalt/10 text-ink" : "border-ink/15 text-ink/65 hover:border-ink/30"}`}>
                {f.name}
                <span className={`rounded-full px-1.5 py-0.5 text-[8px] uppercase ${f.targetSceneId ? "bg-meadow/20 text-meadow-shade" : "bg-amber-400/20 text-amber-800"}`}>{f.targetSceneId ? "Linked" : "No scene"}</span>
              </button>
            ))}
          </div>
        )}

        {/* Add region */}
        <div className="mb-3 flex gap-2">
          <button type="button" onClick={onAddRect} className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-bold text-ink/70 hover:border-cobalt"><Square className="h-3.5 w-3.5" /> Add area</button>
          <button type="button" onClick={onAddEllipse} className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-bold text-ink/70 hover:border-cobalt"><Circle className="h-3.5 w-3.5" /> Add oval</button>
        </div>

        {/* Selected focus area editor */}
        {selected ? (
          <div className="space-y-2.5 rounded-2xl border border-ink/10 bg-white/50 p-3">
            <label className="block">
              <span className="text-[9px] font-bold uppercase tracking-wide text-ink/45">Name</span>
              <input value={selected.name} onChange={(e) => onPatch({ name: e.target.value })} onFocus={() => onSnapChange("expanded")} className="mt-0.5 w-full rounded-lg border border-ink/15 bg-white/80 py-1.5 px-2 text-sm text-ink focus:border-cobalt focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-[9px] font-bold uppercase tracking-wide text-ink/45">Hint shown to visitors</span>
              <input value={selected.previewHint ?? ""} onChange={(e) => onPatch({ previewHint: e.target.value })} onFocus={() => onSnapChange("expanded")} placeholder="Explore desk" className="mt-0.5 w-full rounded-lg border border-ink/15 bg-white/80 py-1.5 px-2 text-sm text-ink focus:border-cobalt focus:outline-none" />
            </label>

            {/* Detail scene link */}
            {linkedScene ? (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-meadow/10 px-2.5 py-2">
                <span className="text-[11px] font-bold text-meadow-shade">Linked: {linkedScene.name}</span>
                <button type="button" onClick={() => onOpenScene(linkedScene.id)} className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-[11px] font-bold text-parchment hover:bg-ink/85"><ExternalLink className="h-3 w-3" /> Edit scene</button>
              </div>
            ) : (
              <button type="button" onClick={onCreateScene} className="inline-flex items-center gap-1 rounded-full bg-cobalt px-3 py-1.5 text-xs font-bold text-white hover:bg-cobalt/90"><Plus className="h-3.5 w-3.5" /> Create detail scene</button>
            )}

            {/* Trigger + transition (template-author / advanced) */}
            {advanced ? (
              <div className="grid grid-cols-2 gap-2 border-t border-ink/10 pt-2">
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
            ) : null}

            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => onPatch({ enabled: !selected.enabled })} aria-pressed={!selected.enabled} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold ${selected.enabled ? "border-ink/15 text-ink/60" : "border-terracotta text-terracotta"}`}>{selected.enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />} {selected.enabled ? "Enabled" : "Disabled"}</button>
              <button type="button" onClick={() => onPatch({ locked: !selected.locked })} aria-pressed={selected.locked} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold ${selected.locked ? "border-terracotta text-terracotta" : "border-ink/15 text-ink/60"}`}>{selected.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />} {selected.locked ? "Locked" : "Lock"}</button>
              <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 rounded-md border border-terracotta/40 px-2 py-1 text-[10px] font-bold text-terracotta hover:bg-terracotta/10"><Trash2 className="h-3 w-3" /> Delete</button>
            </div>
            <p className="text-[10px] text-ink/40">Drag the region on the Nest to move it; use its corner handles to resize.</p>
          </div>
        ) : focusAreas.length ? (
          <p className="text-xs text-ink/45">Tap a region above (or on the Nest) to edit it.</p>
        ) : null}
      </div>
    </MobileBottomSheet>
  );
}
