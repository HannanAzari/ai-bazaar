"use client";

import { useMemo, useRef, useState } from "react";
import {
  Download,
  FolderOpen,
  Grid3x3,
  Magnet,
  Redo2,
  RotateCcw,
  Save,
  Undo2,
  Upload,
} from "lucide-react";
import { GoldenLivingNestStage } from "@/components/nest/golden-living-nest-stage";
import {
  GOLDEN_LIVING_NEST_ASSETS,
  GOLDEN_LIVING_NEST_ASSETS_BY_ID,
  GOLDEN_LIVING_NEST_COMPOSED,
  GOLDEN_LIVING_NEST_INTERACTIONS,
  GOLDEN_LIVING_NEST_INTERACTIONS_BY_ID,
  GOLDEN_LIVING_NEST_TEMPLATE,
} from "@/lib/fixtures/golden-living-nest";
import {
  addObject,
  createEditorDocumentFromTemplate,
  editorDocumentToStage,
  removeObject,
  reorderObject,
  serializeEditorDocument,
  setObjectProps,
  type ReorderOp,
} from "@/lib/nest-editor";
import type { EditableNestDocument, EditableNestObject } from "@/lib/nest-editor-types";
import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type History,
} from "@/lib/nest-editor-history";
import { clearDraft, importDocumentJson, loadDraft, saveDraft } from "@/lib/nest-editor-storage";
import { editorWarnings } from "@/lib/nest-editor-policy";
import { EditorCanvas } from "@/components/nest/editor/editor-canvas";
import { AssetTray } from "@/components/nest/editor/asset-tray";
import { PropertiesPanel } from "@/components/nest/editor/properties-panel";

const ASSETS = GOLDEN_LIVING_NEST_ASSETS_BY_ID;

function freshDocument(): EditableNestDocument {
  return createEditorDocumentFromTemplate({
    template: GOLDEN_LIVING_NEST_TEMPLATE,
    composed: GOLDEN_LIVING_NEST_COMPOSED,
  });
}

export function NestEditor() {
  const [history, setHistory] = useState<History<EditableNestDocument>>(() => createHistory(freshDocument(), 50));
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [showGrid, setShowGrid] = useState(false);
  const [snap, setSnap] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const doc = history.present;
  const selected = selectedId ? doc.objects.find((o) => o.instanceId === selectedId) : undefined;
  const ambience = useMemo(
    () => GOLDEN_LIVING_NEST_TEMPLATE.ambiencePresets.find((p) => p.id === doc.ambiencePresetId),
    [doc.ambiencePresetId],
  );
  const warnings = useMemo(() => editorWarnings(doc.objects, ASSETS), [doc.objects]);

  // One history entry per committed change.
  const commit = (next: EditableNestDocument) => setHistory((h) => pushHistory(h, next));
  const flash = (kind: "ok" | "error", text: string) => setStatus({ kind, text });

  const onAdd = (asset: (typeof GOLDEN_LIVING_NEST_ASSETS)[number]) => {
    const { doc: next, instanceId } = addObject(doc, asset);
    commit(next);
    setSelectedId(instanceId);
  };
  const onPatch = (patch: Partial<EditableNestObject>) => {
    if (!selectedId) return;
    commit(setObjectProps(doc, selectedId, patch, ASSETS));
  };
  const onReorder = (op: ReorderOp) => {
    if (!selectedId) return;
    commit(reorderObject(doc, selectedId, op));
  };
  const onRemove = () => {
    if (!selectedId) return;
    commit(removeObject(doc, selectedId));
    setSelectedId(undefined);
  };

  const save = () => {
    const stamped = { ...doc, updatedAt: new Date().toISOString() };
    const r = saveDraft(stamped);
    flash(r.ok ? "ok" : "error", r.ok ? "Draft saved" : `Save failed: ${r.error}`);
  };
  const load = () => {
    const r = loadDraft(doc.id);
    if (r.ok && r.doc) {
      setHistory(createHistory(r.doc, 50));
      setSelectedId(undefined);
      flash("ok", "Draft loaded");
    } else {
      flash("error", r.errors.join("; "));
    }
  };
  const reset = () => {
    clearDraft(doc.id);
    setHistory(createHistory(freshDocument(), 50));
    setSelectedId(undefined);
    flash("ok", "Reset to Golden Living Nest");
  };
  const exportJson = () => {
    try {
      const blob = new Blob([serializeEditorDocument(doc)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      flash("ok", "Exported JSON");
    } catch (e) {
      flash("error", `Export failed: ${(e as Error).message}`);
    }
  };
  const onImportFile = async (file: File) => {
    const text = await file.text();
    const r = importDocumentJson(text);
    if (r.ok && r.doc) {
      setHistory(createHistory(r.doc, 50));
      setSelectedId(undefined);
      flash("ok", "Imported document");
    } else {
      flash("error", `Import rejected: ${r.errors.join("; ")}`);
    }
  };

  const preview = mode === "preview" ? editorDocumentToStage(doc, ASSETS, GOLDEN_LIVING_NEST_TEMPLATE) : null;

  return (
    <div className="space-y-3">
      {/* Header + mode toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-terracotta">Nestudio · Internal</p>
          <h1 className="display truncate text-xl leading-tight">Nest Editor</h1>
        </div>
        <div className="inline-flex shrink-0 rounded-full border border-ink/15 bg-white/70 p-1 text-xs font-bold">
          {(["edit", "preview"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={`rounded-full px-3 py-1.5 capitalize transition ${mode === m ? "bg-ink text-parchment" : "text-ink/55 hover:text-ink/80"}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      {mode === "edit" ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-ink/10 bg-white/50 p-2">
          <ToolBtn onClick={() => setHistory(undoHistory(history))} disabled={!canUndo(history)} label="Undo"><Undo2 className="h-4 w-4" /></ToolBtn>
          <ToolBtn onClick={() => setHistory(redoHistory(history))} disabled={!canRedo(history)} label="Redo"><Redo2 className="h-4 w-4" /></ToolBtn>
          <span className="mx-1 h-5 w-px bg-ink/10" />
          <ToolBtn onClick={() => setShowGrid((s) => !s)} active={showGrid} label="Grid"><Grid3x3 className="h-4 w-4" /></ToolBtn>
          <ToolBtn onClick={() => setSnap((s) => !s)} active={snap} label="Snap"><Magnet className="h-4 w-4" /></ToolBtn>
          <span className="mx-1 h-5 w-px bg-ink/10" />
          <ToolBtn onClick={save} label="Save"><Save className="h-4 w-4" /></ToolBtn>
          <ToolBtn onClick={load} label="Load"><FolderOpen className="h-4 w-4" /></ToolBtn>
          <ToolBtn onClick={exportJson} label="Export"><Download className="h-4 w-4" /></ToolBtn>
          <ToolBtn onClick={() => fileRef.current?.click()} label="Import"><Upload className="h-4 w-4" /></ToolBtn>
          <ToolBtn onClick={reset} label="Reset"><RotateCcw className="h-4 w-4" /></ToolBtn>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImportFile(f); e.target.value = ""; }} />
        </div>
      ) : null}

      {status ? (
        <p className={`rounded-lg px-3 py-1.5 text-xs ${status.kind === "ok" ? "bg-meadow/15 text-meadow-shade" : "bg-terracotta/15 text-terracotta"}`}>{status.text}</p>
      ) : null}

      {mode === "edit" ? (
        <>
          <EditorCanvas
            doc={doc}
            assetsById={ASSETS}
            ambience={ambience}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCommit={commit}
            showGrid={showGrid}
            snap={snap}
          />

          {/* Advisory warnings (non-blocking) */}
          {warnings.length ? (
            <details className="rounded-xl border border-amber-400/40 bg-amber-50/50 px-3 py-2 text-xs text-ink/70">
              <summary className="cursor-pointer font-bold text-ink/80">{warnings.length} advisory warning{warnings.length === 1 ? "" : "s"}</summary>
              <ul className="mt-1 list-disc pl-4">
                {warnings.map((w, i) => (
                  <li key={i}><span className="font-mono text-[10px]">{w.instanceId}</span>: {w.message}</li>
                ))}
              </ul>
            </details>
          ) : null}

          {selected ? (
            <PropertiesPanel
              object={selected}
              assetName={ASSETS[selected.assetId]?.name ?? selected.assetId}
              interactions={GOLDEN_LIVING_NEST_INTERACTIONS}
              onPatch={onPatch}
              onReorder={onReorder}
              onRemove={onRemove}
            />
          ) : (
            <p className="text-xs text-ink/45">Tap an object to select it, then drag to move or use the handles to resize.</p>
          )}

          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[.18em] text-ink/45">Asset library</p>
            <AssetTray assets={GOLDEN_LIVING_NEST_ASSETS} onAdd={onAdd} />
          </div>
        </>
      ) : (
        <div className="space-y-2">
          {preview ? (
            <GoldenLivingNestStage
              template={preview.template}
              assetsById={ASSETS}
              interactionsById={GOLDEN_LIVING_NEST_INTERACTIONS_BY_ID}
              composed={preview.composed}
            />
          ) : null}
          <p className="text-center text-xs text-ink/45">Preview — editor controls hidden. Interactions, ambience, and contact shadows are live.</p>
        </div>
      )}
    </div>
  );
}

function ToolBtn({ onClick, disabled, active, label, children }: { onClick: () => void; disabled?: boolean; active?: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={label}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "border-cobalt bg-cobalt/15 text-cobalt" : "border-ink/15 text-ink/65 hover:border-ink/30"
      }`}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
