"use client";

import type { Interaction } from "@/lib/nest-types";
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Eye, EyeOff, Lock, Trash2, Unlock } from "lucide-react";
import type { EditableNestObject, EditorPlane } from "@/lib/nest-editor-types";
import { EDITOR_PLANES } from "@/lib/nest-editor-types";
import type { ReorderOp } from "@/lib/nest-editor";

// Precision properties panel for the selected instance: x/y/width/height, z-index,
// plane, anchor, lock, visibility, contact shadow, and the semantic interaction.
// Values are normalized with reasonable precision; edits apply immediately. Animation
// file-format internals are intentionally NOT exposed to creators.

function Num({ label, value, onChange, step = 0.001, min = -1, max = 2 }: { label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[9px] font-bold uppercase tracking-wide text-ink/45">{label}</span>
      <input
        type="number"
        value={Number(value.toFixed(4))}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-ink/15 bg-white/70 px-1.5 py-1 text-xs text-ink focus:border-cobalt focus:outline-none"
      />
    </label>
  );
}

export function PropertiesPanel({
  object,
  assetName,
  interactions,
  onPatch,
  onReorder,
  onRemove,
}: {
  object: EditableNestObject;
  assetName: string;
  interactions: Interaction[];
  onPatch: (patch: Partial<EditableNestObject>) => void;
  onReorder: (op: ReorderOp) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-ink/10 bg-white/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink/45">Selected</p>
          <h3 className="display truncate text-sm leading-tight text-ink">{assetName}</h3>
          <p className="truncate font-mono text-[9px] text-ink/40">{object.instanceId}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => onPatch({ locked: !object.locked })} className="rounded-md border border-ink/15 p-1.5 hover:bg-ink/5" title={object.locked ? "Unlock" : "Lock"} aria-pressed={object.locked}>
            {object.locked ? <Lock className="h-3.5 w-3.5 text-terracotta" /> : <Unlock className="h-3.5 w-3.5 text-ink/60" />}
          </button>
          <button type="button" onClick={() => onPatch({ hidden: !object.hidden })} className="rounded-md border border-ink/15 p-1.5 hover:bg-ink/5" title={object.hidden ? "Show" : "Hide"} aria-pressed={object.hidden}>
            {object.hidden ? <EyeOff className="h-3.5 w-3.5 text-terracotta" /> : <Eye className="h-3.5 w-3.5 text-ink/60" />}
          </button>
          <button type="button" onClick={onRemove} className="rounded-md border border-terracotta/30 p-1.5 text-terracotta hover:bg-terracotta/10" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Num label="x" value={object.x} onChange={(n) => onPatch({ x: n })} />
        <Num label="y" value={object.y} onChange={(n) => onPatch({ y: n })} />
        <Num label="width" value={object.width} onChange={(n) => onPatch({ width: n })} step={0.005} min={0.01} max={1} />
        <Num label="height" value={object.height} onChange={(n) => onPatch({ height: n })} step={0.005} min={0.01} max={1} />
        <Num label="anchor x" value={object.anchor.x} onChange={(n) => onPatch({ anchor: { ...object.anchor, x: n } })} />
        <Num label="anchor y" value={object.anchor.y} onChange={(n) => onPatch({ anchor: { ...object.anchor, y: n } })} />
        <Num label="z-index" value={object.zIndex} onChange={(n) => onPatch({ zIndex: Math.round(n) })} step={1} min={0} max={99} />
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] font-bold uppercase tracking-wide text-ink/45">plane</span>
          <select value={object.plane} onChange={(e) => onPatch({ plane: e.target.value as EditorPlane })} className="w-full rounded-md border border-ink/15 bg-white/70 px-1 py-1 text-[10px] text-ink focus:border-cobalt focus:outline-none">
            {EDITOR_PLANES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-ink/15">
          <button type="button" onClick={() => onReorder("back")} className="p-1.5 hover:bg-ink/5" title="Send to back"><ArrowDownToLine className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => onReorder("backward")} className="border-l border-ink/15 p-1.5 hover:bg-ink/5" title="Send backward"><ArrowDown className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => onReorder("forward")} className="border-l border-ink/15 p-1.5 hover:bg-ink/5" title="Bring forward"><ArrowUp className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => onReorder("front")} className="border-l border-ink/15 p-1.5 hover:bg-ink/5" title="Bring to front"><ArrowUpToLine className="h-3.5 w-3.5" /></button>
        </div>
        <label className="inline-flex items-center gap-1 text-[10px] font-bold text-ink/60">
          <input type="checkbox" checked={Boolean(object.contactShadow)} onChange={(e) => onPatch({ contactShadow: e.target.checked })} /> shadow
        </label>
      </div>

      <label className="flex flex-col gap-0.5">
        <span className="text-[9px] font-bold uppercase tracking-wide text-ink/45">interaction (semantic)</span>
        <select
          value={object.interactionId ?? ""}
          onChange={(e) => onPatch({ interactionId: e.target.value || undefined })}
          className="w-full rounded-md border border-ink/15 bg-white/70 px-1.5 py-1 text-[11px] text-ink focus:border-cobalt focus:outline-none"
        >
          <option value="">none</option>
          {interactions.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
