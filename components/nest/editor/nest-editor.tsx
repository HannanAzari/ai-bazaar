"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Check,
  Download,
  Eye,
  FolderOpen,
  Grid3x3,
  LayoutGrid,
  Link2,
  Magnet,
  MoreHorizontal,
  Move,
  Play,
  Redo2,
  RotateCcw,
  Save,
  Settings2,
  TriangleAlert,
  Upload,
  UserCog,
  ZoomIn,
  ZoomOut,
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
  duplicateObject,
  editorDocumentToStage,
  flipObject,
  removeObject,
  reorderObject,
  resizeObject,
  serializeEditorDocument,
  setObjectHotspots,
  setObjectProps,
  type ReorderOp,
} from "@/lib/nest-editor";
import type { NestAssetHotspot } from "@/lib/nest-hotspot-types";
import { HotspotBindingSheet } from "@/components/nest/editor/hotspot-binding-sheet";
import type { EditableNestDocument, EditableNestObject } from "@/lib/nest-editor-types";
import { canRedo, canUndo, createHistory, pushHistory, redoHistory, undoHistory, type History } from "@/lib/nest-editor-history";
import { clearDraft, importDocumentJson, loadDraft, saveDraft } from "@/lib/nest-editor-storage";
import { canFlipX, canRotate, editorWarnings, guardrailForAsset } from "@/lib/nest-editor-policy";
import { pushRecent } from "@/lib/nest-editor-asset-index";
import { placementWarnings } from "@/lib/nest-placement";
import { capabilitiesFor, EDITOR_ROLES, roleLabel, type EditorRole } from "@/lib/nest-editor-roles";
import { clampZoom, computeFitZoom } from "@/lib/nest-editor-view";
import { EditorCanvas } from "@/components/nest/editor/editor-canvas";
import { AssetDrawer } from "@/components/nest/editor/asset-drawer";
import { PropertiesPanel } from "@/components/nest/editor/properties-panel";

const ASSETS = GOLDEN_LIVING_NEST_ASSETS_BY_ID;
type Mode = "arrange" | "assets" | "connect" | "preview";
type SaveState = "idle" | "unsaved" | "saving" | "saved";

const freshDocument = (): EditableNestDocument =>
  createEditorDocumentFromTemplate({ template: GOLDEN_LIVING_NEST_TEMPLATE, composed: GOLDEN_LIVING_NEST_COMPOSED });

export function NestEditor() {
  const [history, setHistory] = useState<History<EditableNestDocument>>(() => createHistory(freshDocument(), 50));
  const [mode, setMode] = useState<Mode>("arrange");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [showGrid, setShowGrid] = useState(false);
  const [snap, setSnap] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [toast, setToast] = useState<string | null>(null);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | undefined>(undefined);
  const [previewHotspots, setPreviewHotspots] = useState(false);
  const [role, setRole] = useState<EditorRole>("creator");
  const [mounted, setMounted] = useState(false);
  const caps = capabilitiesFor(role);
  useEffect(() => setMounted(true), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const firstRun = useRef(true);

  const doc = history.present;
  const selected = selectedId ? doc.objects.find((o) => o.instanceId === selectedId) : undefined;
  const selectedAsset = selected ? ASSETS[selected.assetId] : undefined;
  const ambience = useMemo(() => GOLDEN_LIVING_NEST_TEMPLATE.ambiencePresets.find((p) => p.id === doc.ambiencePresetId), [doc.ambiencePresetId]);
  // Boundary/tap-target/plane + placement (support/occupied-zone) advisories. Placeholder
  // (production) warnings are only surfaced to roles that should see them.
  const warnings = useMemo(() => {
    const base = editorWarnings(doc.objects, ASSETS).filter((w) => w.kind !== "placeholder" || caps.showProductionWarnings);
    const placement = placementWarnings(doc.objects, ASSETS).map((p) => ({ instanceId: p.instanceId, kind: p.kind, message: p.message }));
    return [...base, ...placement];
  }, [doc.objects, caps.showProductionWarnings]);
  const selectedWarnings = warnings.filter((w) => w.instanceId === selectedId);
  const selectedIsPlaceholder = Boolean(selectedAsset?.placeholder);

  // Debounced autosave (compact status, not a banner).
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setSaveState("unsaved");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveState("saving");
      saveDraft({ ...doc, updatedAt: new Date().toISOString() });
      setSaveState("saved");
    }, 900);
    return () => clearTimeout(saveTimer.current);
  }, [doc]);

  const flash = (text: string) => {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? null : t)), 2200);
  };
  const commit = (next: EditableNestDocument) => setHistory((h) => pushHistory(h, next));

  // Object operations
  const onAdd = (asset: (typeof GOLDEN_LIVING_NEST_ASSETS)[number]) => {
    const { doc: next, instanceId } = addObject(doc, asset);
    commit(next);
    pushRecent(asset.id);
    setSelectedId(instanceId);
    setMode("arrange");
  };
  const onDuplicate = () => {
    if (!selectedId) return;
    const { doc: next, instanceId } = duplicateObject(doc, selectedId, ASSETS);
    commit(next);
    if (instanceId) setSelectedId(instanceId);
  };
  const onReorder = (op: ReorderOp) => selectedId && commit(reorderObject(doc, selectedId, op));
  const onFlip = () => selectedId && commit(flipObject(doc, selectedId, ASSETS, caps.tunePolicy));
  const onToggleLock = () => selected && commit(setObjectProps(doc, selected.instanceId, { locked: !selected.locked }, ASSETS));
  const onDelete = () => {
    if (!selectedId) return;
    commit(removeObject(doc, selectedId));
    setSelectedId(undefined);
  };
  const onPatch = (patch: Partial<EditableNestObject>) => selectedId && commit(setObjectProps(doc, selectedId, patch, ASSETS));
  const commitHotspots = (hotspots: NestAssetHotspot[]) => {
    if (selectedId) commit(setObjectHotspots(doc, selectedId, hotspots));
  };
  const onResetScale = () => {
    if (!selected) return;
    const g = guardrailForAsset(ASSETS[selected.assetId]);
    commit(resizeObject(doc, selected.instanceId, g.recommendedWidth, ASSETS));
  };

  // Document operations
  const saveNow = () => {
    const r = saveDraft({ ...doc, updatedAt: new Date().toISOString() });
    setSaveState(r.ok ? "saved" : "unsaved");
    flash(r.ok ? "Saved ✓" : `Save failed: ${r.error}`);
  };
  const load = () => {
    const r = loadDraft(doc.id);
    if (r.ok && r.doc) {
      setHistory(createHistory(r.doc, 50));
      setSelectedId(undefined);
      flash("Draft loaded");
    } else flash(r.errors.join("; "));
  };
  const reset = () => {
    clearDraft(doc.id);
    setHistory(createHistory(freshDocument(), 50));
    setSelectedId(undefined);
    flash("Reset to Golden Living Nest");
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
      flash("Exported JSON");
    } catch (e) {
      flash(`Export failed: ${(e as Error).message}`);
    }
  };
  const onImportFile = async (file: File) => {
    const r = importDocumentJson(await file.text());
    if (r.ok && r.doc) {
      setHistory(createHistory(r.doc, 50));
      setSelectedId(undefined);
      flash("Imported document");
    } else flash(`Import rejected: ${r.errors.join("; ")}`);
  };

  const setZoomFit = () => setZoom(computeFitZoom());
  const zoomIn = () => setZoom((z) => clampZoom(z + 0.15));
  const zoomOut = () => setZoom((z) => clampZoom(z - 0.15));

  const preview = mode === "preview" ? editorDocumentToStage(doc, ASSETS, GOLDEN_LIVING_NEST_TEMPLATE) : null;
  const saveLabel = saveState === "saving" ? "Saving…" : saveState === "unsaved" ? "Unsaved" : saveState === "saved" ? "Saved ✓" : "";

  const ui = (
    <div className="fixed inset-0 z-[110] flex flex-col bg-parchment" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* PREVIEW: clean, no editor chrome (just a way back) */}
      {mode === "preview" ? (
        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-3">
          <button type="button" onClick={() => setMode("arrange")} className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-ink/85 px-3 py-1.5 text-xs font-bold text-parchment" style={{ marginTop: "env(safe-area-inset-top)" }}>
            <ArrowLeft className="h-4 w-4" /> Edit
          </button>
          {/* Internal debug: reveal hotspot regions (template-author/internal only). */}
          {caps.showDebug ? (
            <button type="button" onClick={() => setPreviewHotspots((v) => !v)} aria-pressed={previewHotspots} className={`absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ${previewHotspots ? "bg-teal text-white" : "bg-ink/15 text-ink/60"}`} style={{ marginTop: "env(safe-area-inset-top)" }} title="Internal: show hotspot regions">
              <Eye className="h-4 w-4" /> Hotspots
            </button>
          ) : null}
          {preview ? <GoldenLivingNestStage template={preview.template} assetsById={ASSETS} interactionsById={GOLDEN_LIVING_NEST_INTERACTIONS_BY_ID} composed={preview.composed} debugHotspots={previewHotspots} /> : null}
        </div>
      ) : (
        <>
          {/* Top toolbar (~56px) */}
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-ink/10 px-2">
            <div className="flex items-center gap-1">
              <a href="/design" aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full text-ink/70 hover:bg-ink/5"><ArrowLeft className="h-5 w-5" /></a>
              <ToolIcon label="Undo" onClick={() => setHistory(undoHistory(history))} disabled={!canUndo(history)}><RotateCcw className="h-5 w-5 -scale-x-100" /></ToolIcon>
              <ToolIcon label="Redo" onClick={() => setHistory(redoHistory(history))} disabled={!canRedo(history)}><Redo2 className="h-5 w-5" /></ToolIcon>
            </div>
            <span className={`text-[11px] font-bold ${saveState === "unsaved" ? "text-terracotta" : "text-ink/45"}`}>{saveLabel}</span>
            <div className="flex items-center gap-1">
              <div className="relative">
                <ToolIcon label="More" onClick={() => setMoreOpen((v) => !v)} active={moreOpen}>
                  <MoreHorizontal className="h-5 w-5" />
                  {warnings.length ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500" /> : null}
                </ToolIcon>
                {moreOpen ? (
                  <MoreMenu
                    onClose={() => setMoreOpen(false)}
                    role={role}
                    onRole={setRole}
                    caps={caps}
                    showGrid={showGrid}
                    snap={snap}
                    zoom={zoom}
                    warnings={warnings.length}
                    onToggleGrid={() => setShowGrid((s) => !s)}
                    onToggleSnap={() => setSnap((s) => !s)}
                    onFit={setZoomFit}
                    onZoomIn={zoomIn}
                    onZoomOut={zoomOut}
                    onSave={saveNow}
                    onLoad={load}
                    onImport={() => fileRef.current?.click()}
                    onExport={exportJson}
                    onReset={reset}
                    onAdvanced={() => { setMoreOpen(false); setAdvancedOpen(true); }}
                  />
                ) : null}
              </div>
              <button type="button" onClick={() => { saveNow(); window.location.href = "/design"; }} className="ml-1 inline-flex h-9 items-center gap-1 rounded-full bg-ink px-3 text-xs font-bold text-parchment hover:bg-ink/85"><Check className="h-4 w-4" /> Done</button>
            </div>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImportFile(f); e.target.value = ""; }} />
          </header>

          {/* Canvas area (hero) */}
          <div className="relative min-h-0 flex-1">
            <EditorCanvas
              doc={doc}
              assetsById={ASSETS}
              ambience={ambience}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCommit={commit}
              showGrid={caps.showDebug && showGrid}
              snap={caps.showDebug && snap}
              advanced={advancedOpen && caps.showPrecision}
              zoom={zoom}
              onDuplicate={onDuplicate}
              onReorder={onReorder}
              onFlip={onFlip}
              onToggleLock={onToggleLock}
              onDelete={onDelete}
              connect={mode === "connect"}
              selectedHotspotId={selectedHotspotId}
              onSelectHotspot={setSelectedHotspotId}
              hotspotAuthoring={mode === "connect" && caps.authorHotspots}
              onHotspotsCommit={commitHotspots}
            />

            {/* Small placeholder indicator on the selected asset (details in Advanced). */}
            {selectedIsPlaceholder && mode === "arrange" ? (
              <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-1 text-[10px] font-bold text-amber-900 shadow" title="Placeholder art (not production-ready)">
                <TriangleAlert className="h-3 w-3" /> placeholder
              </span>
            ) : null}

            {/* Contextual advisory warning chip for the selected object (gentle nudge). */}
            {selectedWarnings.length ? (
              <button type="button" onClick={() => caps.showPrecision && setAdvancedOpen(true)} className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-amber-400/50 bg-amber-50/95 px-3 py-1 text-[11px] font-bold text-amber-800 shadow">
                {selectedWarnings[0].message}{caps.showPrecision ? " · Details" : ""}
              </button>
            ) : null}

            {/* Asset drawer overlay (canvas remains visible above) */}
            {mode === "assets" ? (
              <div className="absolute inset-x-0 bottom-0 z-30 h-[58%]">
                <AssetDrawer assets={GOLDEN_LIVING_NEST_ASSETS} advanced={caps.showProductionWarnings} onAdd={onAdd} onClose={() => setMode("arrange")} />
              </div>
            ) : null}

            {/* Connect hint / binding sheet overlay (canvas stays visible above) */}
            {mode === "connect" ? (
              selected ? (
                <div className="absolute inset-x-0 bottom-0 z-30">
                  <HotspotBindingSheet
                    object={selected}
                    assetName={ASSETS[selected.assetId]?.name ?? selected.assetId}
                    selectedHotspotId={selectedHotspotId}
                    advanced={caps.authorHotspots}
                    onSelectHotspot={setSelectedHotspotId}
                    onCommit={commitHotspots}
                    onClose={() => { setSelectedId(undefined); setSelectedHotspotId(undefined); }}
                  />
                </div>
              ) : (
                <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-teal/30 bg-parchment/95 px-4 py-2 text-xs font-bold text-ink/70 shadow">
                  Tap an object to connect its interactions
                </div>
              )
            ) : null}
          </div>

          {/* Bottom command bar (~60px) */}
          <nav className="flex h-16 shrink-0 items-center justify-around gap-1 border-t border-ink/10 px-3 py-1.5">
            <ModeBtn active={mode === "arrange"} label="Arrange" onClick={() => setMode("arrange")}><Move className="h-5 w-5" /></ModeBtn>
            <ModeBtn active={mode === "assets"} label="Assets" onClick={() => { setSelectedId(undefined); setMode("assets"); }}><LayoutGrid className="h-5 w-5" /></ModeBtn>
            <ModeBtn active={mode === "connect"} label="Connect" onClick={() => { setSelectedHotspotId(undefined); setMode("connect"); }}><Link2 className="h-5 w-5" /></ModeBtn>
            <ModeBtn active={false} label="Preview" onClick={() => { setSelectedId(undefined); setSelectedHotspotId(undefined); setMode("preview"); }}><Play className="h-5 w-5" /></ModeBtn>
          </nav>
        </>
      )}

      {/* Advanced sheet (internal precision controls — hidden by default) */}
      {advancedOpen && mode !== "connect" && caps.showPrecision ? (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-ink/30" onClick={() => setAdvancedOpen(false)}>
          <div className="max-h-[80%] overflow-y-auto rounded-t-3xl bg-parchment p-3 shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-ink/15" />
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-terracotta">Advanced · Internal</p>
              <button type="button" onClick={() => setAdvancedOpen(false)} className="rounded-full px-3 py-1 text-xs font-bold text-ink/60 hover:bg-ink/5">Done</button>
            </div>
            {selected ? (
              <>
                <PropertiesPanel
                  object={selected}
                  assetName={selectedAsset?.name ?? selected.assetId}
                  interactions={GOLDEN_LIVING_NEST_INTERACTIONS}
                  canRotate={canRotate(selectedAsset)}
                  canFlip={canFlipX(selectedAsset)}
                  onPatch={onPatch}
                  onReorder={onReorder}
                  onRemove={onDelete}
                  onResetScale={onResetScale}
                />
                {selectedWarnings.length ? (
                  <div className="mt-2 rounded-xl border border-amber-400/40 bg-amber-50/60 p-2 text-xs text-ink/70">
                    <p className="font-bold text-ink/80">Warnings</p>
                    <ul className="mt-1 list-disc pl-4">{selectedWarnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
                  </div>
                ) : null}
                {selectedAsset?.placeholder ? <p className="mt-2 text-[11px] text-amber-800">⚠ Placeholder art (internal): {selectedAsset.artNote}</p> : null}
              </>
            ) : (
              <p className="py-6 text-center text-sm text-ink/50">Select an object to edit its precise properties.</p>
            )}
          </div>
        </div>
      ) : null}

      {toast ? <div className="pointer-events-none absolute bottom-20 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-ink/90 px-4 py-2 text-xs font-bold text-parchment shadow-lg">{toast}</div> : null}
    </div>
  );

  return mounted ? createPortal(ui, document.body) : null;
}

function ToolIcon({ label, onClick, disabled, active, small, children }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; small?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={active} title={label} className={`relative flex items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-35 ${small ? "h-9 w-9" : "h-10 w-10"} ${active ? "bg-cobalt/15 text-cobalt" : "text-ink/70 hover:bg-ink/5"}`}>
      {children}
    </button>
  );
}

function ModeBtn({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] font-bold transition ${active ? "bg-ink/5 text-cobalt" : "text-ink/55 hover:text-ink/80"}`}>
      {children}
      {label}
    </button>
  );
}

function MoreMenu({ onClose, role, onRole, caps, showGrid, snap, zoom, warnings, onToggleGrid, onToggleSnap, onFit, onZoomIn, onZoomOut, onSave, onLoad, onImport, onExport, onReset, onAdvanced }: {
  onClose: () => void;
  role: EditorRole;
  onRole: (r: EditorRole) => void;
  caps: ReturnType<typeof capabilitiesFor>;
  showGrid: boolean;
  snap: boolean;
  zoom: number;
  warnings: number;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSave: () => void;
  onLoad: () => void;
  onImport: () => void;
  onExport: () => void;
  onReset: () => void;
  onAdvanced: () => void;
}) {
  const Item = ({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) => (
    <button type="button" onClick={() => { onClick(); }} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-ink/5 ${active ? "text-cobalt" : "text-ink/75"}`}>{icon} {label}</button>
  );
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-2xl border border-ink/10 bg-parchment p-1 shadow-xl">
        {/* Role switch (prototype capability levels) */}
        <div className="px-2 pb-1 pt-1.5">
          <p className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-ink/40"><UserCog className="h-3 w-3" /> Mode</p>
          <div className="flex gap-1">
            {EDITOR_ROLES.map((r) => (
              <button key={r} type="button" onClick={() => onRole(r)} className={`flex-1 rounded-md px-1.5 py-1 text-[9px] font-bold transition ${role === r ? "bg-ink text-parchment" : "bg-white/70 text-ink/55 hover:text-ink/80"}`}>
                {roleLabel(r).split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
        <div className="my-1 h-px bg-ink/10" />
        {/* View / zoom — advanced roles only (creators get a fitted scene by default) */}
        {caps.showPrecision ? (
          <>
            <p className="px-3 pb-0.5 pt-1 text-[9px] font-bold uppercase tracking-wider text-ink/40">View</p>
            <div className="flex gap-1 px-2 pb-1">
              <button type="button" onClick={onZoomOut} className="flex-1 rounded-md border border-ink/15 py-1 text-ink/65 hover:bg-ink/5"><ZoomOut className="mx-auto h-4 w-4" /></button>
              <button type="button" onClick={onFit} className={`flex-[1.4] rounded-md border py-1 text-[10px] font-bold ${zoom === 1 ? "border-cobalt text-cobalt" : "border-ink/15 text-ink/65"} hover:bg-ink/5`}>Fit</button>
              <button type="button" onClick={onZoomIn} className="flex-1 rounded-md border border-ink/15 py-1 text-ink/65 hover:bg-ink/5"><ZoomIn className="mx-auto h-4 w-4" /></button>
            </div>
            <div className="my-1 h-px bg-ink/10" />
          </>
        ) : null}
        {caps.showPrecision ? <Item icon={<Settings2 className="h-4 w-4" />} label={`Advanced${warnings ? ` (${warnings} ⚠)` : ""}`} onClick={() => { onAdvanced(); }} /> : null}
        {caps.showDebug ? <Item icon={<Grid3x3 className="h-4 w-4" />} label="Grid" onClick={onToggleGrid} active={showGrid} /> : null}
        {caps.showDebug ? <Item icon={<Magnet className="h-4 w-4" />} label="Snap to grid" onClick={onToggleSnap} active={snap} /> : null}
        <div className="my-1 h-px bg-ink/10" />
        <Item icon={<Save className="h-4 w-4" />} label="Save now" onClick={() => { onSave(); onClose(); }} />
        <Item icon={<FolderOpen className="h-4 w-4" />} label="Load draft" onClick={() => { onLoad(); onClose(); }} />
        <Item icon={<Upload className="h-4 w-4" />} label="Import JSON" onClick={() => { onImport(); onClose(); }} />
        <Item icon={<Download className="h-4 w-4" />} label="Export JSON" onClick={() => { onExport(); onClose(); }} />
        <Item icon={<RotateCcw className="h-4 w-4" />} label="Reset" onClick={() => { onReset(); onClose(); }} />
      </div>
    </>
  );
}
