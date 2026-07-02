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
import {
  GOLDEN_LIVING_NEST_COMPOSED,
  GOLDEN_LIVING_NEST_INTERACTIONS,
  GOLDEN_LIVING_NEST_INTERACTIONS_BY_ID,
  GOLDEN_LIVING_NEST_TEMPLATE,
} from "@/lib/fixtures/golden-living-nest";
import { productionEditorCatalog } from "@/lib/nest-editor-bridge";
import { PublishGate } from "@/components/nest/editor/publish-gate";
import type { LivingNestAsset } from "@/lib/nest-visual-types";
import {
  addObject,
  createEditorDocumentFromTemplate,
  duplicateObject,
  editorDocumentToStage,
  flipObject,
  placeOnSupport,
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
import { placementWarnings, supportCandidates } from "@/lib/nest-placement";
import { overlapAdvisories } from "@/lib/nest-overlap-advisories";
import type { BottomSheetSnapPoint } from "@/components/nest/editor/mobile-bottom-sheet";
import { capabilitiesFor, EDITOR_ROLES, roleLabel, type EditorRole } from "@/lib/nest-editor-roles";
import { clampZoom, computeFitZoom } from "@/lib/nest-editor-view";
import { EditorCanvas } from "@/components/nest/editor/editor-canvas";
import { AssetDrawer } from "@/components/nest/editor/asset-drawer";
import { PropertiesPanel } from "@/components/nest/editor/properties-panel";
import { FocusEditorOverlay } from "@/components/nest/editor/focus-editor-overlay";
import { FocusSheet } from "@/components/nest/editor/focus-sheet";
import type { NestFocusArea } from "@/lib/nest-focus-types";
import {
  addFocusArea,
  createDetailScene,
  ensureFocusChildScene,
  focusAreaHasContent,
  fitRectToAspectRatio,
  getDetailScene,
  mainSceneId,
  nextFocusAreaName,
  removeFocusArea,
  resolveFocusSceneBase,
  setDetailSceneObjects,
  updateFocusArea,
} from "@/lib/nest-focus-scenes";
import { NestSceneNavigator } from "@/components/nest/nest-scene-navigator";
import { FocusedParentBase } from "@/components/nest/focused-zoom-stage";
import { ProjectedFocusChildren } from "@/components/nest/projected-focus-children";
import { InheritedInteractionLayer } from "@/components/nest/inherited-interaction-layer";
import { resolveInheritedFocusObjects, setInheritedHotspotBinding } from "@/lib/nest-focus-projection";
import { SurfaceEditorSheet } from "@/components/nest/editor/surface-editor-sheet";
import { resolveObjectSurfaces, setObjectSurfaceContent } from "@/lib/nest-surfaces";
import { ImagePlus } from "lucide-react";
import { Maximize2 } from "lucide-react";

/** A default fixed-ratio (square = 3:4 on-screen) focus rectangle for new areas. */
const DEFAULT_FOCUS_RECT = fitRectToAspectRatio({ x: 0.34, y: 0.34, width: 0.32, height: 0.32 });

type Mode = "arrange" | "assets" | "connect" | "focus" | "surface" | "preview";
type SaveState = "idle" | "unsaved" | "saving" | "saved";

const freshDocument = (): EditableNestDocument =>
  createEditorDocumentFromTemplate({ template: GOLDEN_LIVING_NEST_TEMPLATE, composed: GOLDEN_LIVING_NEST_COMPOSED });

export function NestEditor({ seed, documentId }: { seed?: EditableNestDocument; documentId?: string } = {}) {
  // `seed` (M12.x bridge): open on a document created by onboarding (production
  // background + placements) instead of the built-in Golden Living Nest fixture.
  // The catalog IS the production library: `ASSETS` (all statuses, so placements
  // resolve) + `trayAssets` (approved/featured → the Assets tray). No golden-living art.
  const editorCatalog = useMemo(() => productionEditorCatalog(), []);
  const ASSETS = editorCatalog.assetsById;
  const trayAssets = editorCatalog.assets;
  const [showPublish, setShowPublish] = useState(false);
  const [history, setHistory] = useState<History<EditableNestDocument>>(() => createHistory(seed ?? freshDocument(), 50));
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
  // Each drawer remembers its own snap point across open/close (Phase 9/10).
  const [assetSnap, setAssetSnap] = useState<BottomSheetSnapPoint>("half");
  const [connectSnap, setConnectSnap] = useState<BottomSheetSnapPoint>("half");
  const [focusSnap, setFocusSnap] = useState<BottomSheetSnapPoint>("half");
  // M7C: which scene is being edited (the main id, or a detail-scene id) + focus selection.
  const [activeSceneId, setActiveSceneId] = useState<string>("");
  const [selectedFocusId, setSelectedFocusId] = useState<string | undefined>(undefined);
  // M7C.8: in a child Focus Scene's Connect mode, the selected INHERITED parent object/
  // hotspot (for authoring a child binding override). Mutually exclusive with `selectedId`.
  const [selectedInheritedId, setSelectedInheritedId] = useState<string | undefined>(undefined);
  const [selectedInheritedHotspotId, setSelectedInheritedHotspotId] = useState<string | undefined>(undefined);
  // M8: the surface being edited on the selected object (Surface mode).
  const [selectedSurfaceId, setSelectedSurfaceId] = useState<string | undefined>(undefined);
  const [surfaceSnap, setSurfaceSnap] = useState<BottomSheetSnapPoint>("half");
  // M7C.5: Preview uses the real NestSceneNavigator. `previewFocusId` (set by the Focus
  // sheet's "Preview focus" shortcut) auto-enters that area through the same navigator.
  const [previewFocusId, setPreviewFocusId] = useState<string | undefined>(undefined);
  const [mounted, setMounted] = useState(false);
  const caps = capabilitiesFor(role);
  useEffect(() => setMounted(true), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const firstRun = useRef(true);

  const doc = history.present;
  const mainId = mainSceneId(doc);
  // The scene currently being edited: the Main Nest, or one Detail Scene. The object
  // editing surface operates on `activeDoc` (a scene-scoped view); the full `doc` carries
  // the scene graph + is what history/persistence store.
  const isMainActive = !activeSceneId || activeSceneId === mainId;
  const activeScene = isMainActive ? undefined : getDetailScene(doc, activeSceneId);
  const activeDoc: EditableNestDocument = useMemo(() => {
    if (isMainActive || !activeScene) return doc;
    return {
      ...doc,
      id: `${doc.id}--${activeScene.id}`,
      objects: activeScene.objects,
      backgroundImageUrl: activeScene.backgroundImageUrl ?? doc.backgroundImageUrl,
      aspectRatio: activeScene.viewport.aspectRatio,
      ambiencePresetId: activeScene.ambiencePresetId ?? doc.ambiencePresetId,
      focusAreas: [],
      detailScenes: [],
    };
  }, [doc, isMainActive, activeScene]);

  // M7C.7: the read-only background for the canvas. For a `parent_crop` child Focus Scene
  // this is the parent scene transformed to the focus rectangle — the SAME crop the visitor
  // sees — so the editor never falls back to the flat (empty-looking) Main background. A
  // broken parent reference shows an explicit error, not a blank room.
  const backgroundNode = useMemo<React.ReactNode>(() => {
    if (isMainActive || !activeScene) return undefined;
    if (activeScene.backgroundSource?.type !== "parent_crop") return undefined; // image surface keeps its own bg
    const base = resolveFocusSceneBase(doc, activeSceneId);
    if (!base) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/5 p-6 text-center text-xs font-bold text-ink/55">
          This focus area’s parent view is missing. Re-enter it from the Main Nest.
        </div>
      );
    }
    const parentDoc: EditableNestDocument = { ...doc, objects: base.parentObjects, aspectRatio: base.parentAspectRatio, focusAreas: [], detailScenes: [] };
    const parentStage = editorDocumentToStage(parentDoc, ASSETS, GOLDEN_LIVING_NEST_TEMPLATE);
    return (
      <FocusedParentBase
        parentStage={parentStage}
        assetsById={ASSETS}
        interactionsById={GOLDEN_LIVING_NEST_INTERACTIONS_BY_ID}
        focusBounds={base.focusBounds}
        interactive={false}
      />
    );
  }, [isMainActive, activeScene, doc, activeSceneId, ASSETS]);

  // M7C.8: inherited parent objects (read-only interaction proxies) for the active child
  // Focus Scene, and the read-only overlay drawn over the canvas (Main projections in the
  // Main scene; inherited proxies while authoring a child's Connect mode).
  const inheritedObjects = useMemo(
    () => (!isMainActive && activeScene?.backgroundSource?.type === "parent_crop" ? resolveInheritedFocusObjects(doc, activeSceneId) : []),
    [isMainActive, activeScene, doc, activeSceneId],
  );
  const selectedInherited = inheritedObjects.find((o) => o.derivedId === selectedInheritedId);

  const onSelectInherited = (derivedId: string, hotspotId?: string) => {
    setSelectedId(undefined);
    setSelectedHotspotId(undefined);
    setSelectedInheritedId(derivedId);
    setSelectedInheritedHotspotId(hotspotId);
  };
  // Apply binding edits from the reused HotspotBindingSheet onto INHERITED hotspots: write a
  // child-scene override when the chosen binding differs from the parent's, else clear it.
  // Geometry/enable/lock changes are ignored — inherited geometry stays read-only (V1 rule).
  const commitInheritedBindings = (hotspots: NestAssetHotspot[]) => {
    if (!selectedInherited) return;
    const parentObj = doc.objects.find((o) => o.instanceId === selectedInherited.parentObjectId);
    const now = new Date().toISOString();
    let next = doc;
    for (const h of hotspots) {
      const parentBinding = parentObj?.hotspots?.find((p) => p.id === h.id)?.binding;
      const sameAsParent = JSON.stringify(h.binding ?? null) === JSON.stringify(parentBinding ?? null);
      next = setInheritedHotspotBinding(next, activeSceneId, selectedInherited.parentObjectId, h.id, sameAsParent ? undefined : h.binding, now);
    }
    commit(next);
  };

  // The read-only foreground overlay for the canvas.
  const foregroundNode = isMainActive ? (
    <ProjectedFocusChildren doc={doc} assetsById={ASSETS} mode="editor" />
  ) : mode === "connect" && inheritedObjects.length ? (
    <InheritedInteractionLayer objects={inheritedObjects} mode="connect" selectedObjectId={selectedInheritedId} selectedHotspotId={selectedInheritedHotspotId} onSelect={onSelectInherited} />
  ) : undefined;

  // Inherited selection only exists inside a child scene's Connect mode.
  useEffect(() => {
    if (isMainActive || mode !== "connect") {
      setSelectedInheritedId(undefined);
      setSelectedInheritedHotspotId(undefined);
    }
  }, [isMainActive, mode, activeSceneId]);

  const selected = selectedId ? activeDoc.objects.find((o) => o.instanceId === selectedId) : undefined;
  const selectedAsset = selected ? ASSETS[selected.assetId] : undefined;

  // M8: the surface currently open in the editor (on the selected object).
  const selectedSurface = selected ? resolveObjectSurfaces(selected).find((s) => s.id === selectedSurfaceId) : undefined;
  const onCommitSurface = (content: Parameters<typeof setObjectSurfaceContent>[3]) => {
    if (selectedId && selectedSurfaceId) commitActive(setObjectSurfaceContent(activeDoc, selectedId, selectedSurfaceId, content));
  };
  // Surface selection only exists inside Surface mode; clear it otherwise.
  useEffect(() => {
    if (mode !== "surface") setSelectedSurfaceId(undefined);
  }, [mode, selectedId, activeSceneId]);
  const ambience = useMemo(() => GOLDEN_LIVING_NEST_TEMPLATE.ambiencePresets.find((p) => p.id === activeDoc.ambiencePresetId), [activeDoc.ambiencePresetId]);
  // Boundary/tap-target/plane + placement (support/occupied-zone) advisories. Placeholder
  // (production) warnings are only surfaced to roles that should see them.
  const warnings = useMemo(() => {
    const base = editorWarnings(activeDoc.objects, ASSETS).filter((w) => w.kind !== "placeholder" || caps.showProductionWarnings);
    const placement = placementWarnings(activeDoc.objects, ASSETS).map((p) => ({ instanceId: p.instanceId, kind: p.kind as string, message: p.message }));
    // Composition overlap advisories (avatar-in-furniture, covers window/niche, …).
    const overlaps = overlapAdvisories(activeDoc.objects, ASSETS).map((a) => ({ instanceId: a.instanceId, kind: a.kind as string, message: a.message }));
    return [...base.map((b) => ({ instanceId: b.instanceId, kind: b.kind as string, message: b.message })), ...placement, ...overlaps];
  }, [activeDoc.objects, caps.showProductionWarnings, ASSETS]);
  const selectedWarnings = warnings.filter((w) => w.instanceId === selectedId);
  const selectedIsPlaceholder = Boolean(selectedAsset?.placeholder);

  // Actionable support-surface suggestion for a floating surface-asset (Phase 11).
  const supportSuggestion = useMemo(() => {
    if (!selected) return undefined;
    const floats = warnings.some((w) => w.instanceId === selected.instanceId && w.kind === "support");
    if (!floats) return undefined;
    return supportCandidates(selected, activeDoc.objects, ASSETS)[0];
  }, [selected, activeDoc.objects, warnings, ASSETS]);
  const onPlaceOnSupport = () => {
    if (selectedId && supportSuggestion) commitActive(placeOnSupport(activeDoc, selectedId, supportSuggestion.instanceId, ASSETS));
  };

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
  // Scene-scoped commit: when a Detail Scene is active, object edits write back into that
  // scene's manifest; on Main they commit the full document. One history entry either way.
  const commitActive = (next: EditableNestDocument) => {
    if (isMainActive || !activeScene) commit(next);
    else commit(setDetailSceneObjects(doc, activeSceneId, next.objects, new Date().toISOString()));
  };

  // Object operations (operate on the ACTIVE scene)
  const onAdd = (asset: LivingNestAsset) => {
    const { doc: next, instanceId } = addObject(activeDoc, asset);
    commitActive(next);
    pushRecent(asset.id);
    setSelectedId(instanceId);
    setMode("arrange");
  };
  const onDuplicate = () => {
    if (!selectedId) return;
    const { doc: next, instanceId } = duplicateObject(activeDoc, selectedId, ASSETS);
    commitActive(next);
    if (instanceId) setSelectedId(instanceId);
  };
  const onReorder = (op: ReorderOp) => selectedId && commitActive(reorderObject(activeDoc, selectedId, op));
  const onFlip = () => selectedId && commitActive(flipObject(activeDoc, selectedId, ASSETS, caps.tunePolicy));
  const onToggleLock = () => selected && commitActive(setObjectProps(activeDoc, selected.instanceId, { locked: !selected.locked }, ASSETS));
  const onDelete = () => {
    if (!selectedId) return;
    commitActive(removeObject(activeDoc, selectedId));
    setSelectedId(undefined);
  };
  const onPatch = (patch: Partial<EditableNestObject>) => selectedId && commitActive(setObjectProps(activeDoc, selectedId, patch, ASSETS));
  const commitHotspots = (hotspots: NestAssetHotspot[]) => {
    if (selectedId) commitActive(setObjectHotspots(activeDoc, selectedId, hotspots));
  };
  const onResetScale = () => {
    if (!selected) return;
    const g = guardrailForAsset(ASSETS[selected.assetId]);
    commitActive(resizeObject(activeDoc, selected.instanceId, g.recommendedWidth, ASSETS));
  };

  // ── Focus Area operations (Main scene only; operate on the full document) ──
  const focusAreas = doc.focusAreas ?? [];
  const selectedFocus = focusAreas.find((f) => f.id === selectedFocusId);
  // Create one fixed-ratio (3:4) zoom focus area — the V1 contract. Auto-named + selected
  // immediately (the rectangle appears at once; no form first).
  const onAddFocus = () => {
    const name = nextFocusAreaName(doc.focusAreas ?? []);
    const { doc: next, id } = addFocusArea(doc, { bounds: DEFAULT_FOCUS_RECT, shape: "rect", name, previewHint: `Explore ${name}` });
    const withFocus = updateFocusArea(next, id, { targetType: "zoom_region", focusBounds: DEFAULT_FOCUS_RECT });
    commit(withFocus);
    setSelectedFocusId(id);
  };
  const onResetFocus = () => {
    if (!selectedFocusId) return;
    commit(updateFocusArea(doc, selectedFocusId, { focusBounds: DEFAULT_FOCUS_RECT }));
  };
  // M7C.6 "Enter area": ensure the Focus Area's editable CHILD SCENE exists, then ENTER it
  // in Edit mode (the same editor tools now operate on the child scene). Not a preview.
  const onEnterArea = () => {
    if (!selectedFocusId) return;
    const { doc: next, childSceneId } = ensureFocusChildScene(doc, selectedFocusId, new Date().toISOString());
    commit(next);
    if (childSceneId) {
      setSelectedId(undefined);
      setSelectedFocusId(undefined);
      setActiveSceneId(childSceneId);
      setMode("arrange");
    }
  };
  // Preview from the active editing scene: if inside a child scene, auto-enter its area so
  // the visitor preview starts there; Back-to-edit returns to the same editing scene.
  const onPreview = () => {
    setSelectedId(undefined);
    setSelectedHotspotId(undefined);
    const childArea = !isMainActive && activeScene ? activeScene.parentFocusAreaId : undefined;
    setPreviewFocusId(childArea || undefined);
    setMode("preview");
  };
  const exitPreview = () => {
    setPreviewFocusId(undefined);
    setMode("arrange");
  };
  const onPatchFocus = (patch: Partial<NestFocusArea>) => selectedFocusId && commit(updateFocusArea(doc, selectedFocusId, patch));
  const onDeleteFocus = () => {
    if (!selectedFocusId) return;
    // Confirm only when the child scene holds authored content (objects/nested areas). The
    // delete cascades the child scene; Undo restores both.
    if (focusAreaHasContent(doc, selectedFocusId) && typeof window !== "undefined" && !window.confirm("This focus area has content inside it. Delete the area and everything in it? You can undo.")) return;
    commit(removeFocusArea(doc, selectedFocusId));
    setSelectedFocusId(undefined);
  };
  const onCommitFocusGeometry = (next: NestFocusArea[]) => commit({ ...doc, focusAreas: next });
  const onCreateSceneForFocus = () => {
    if (!selectedFocusId) return;
    const { doc: next, scene } = createDetailScene(doc, { focusAreaId: selectedFocusId, name: selectedFocus?.name ?? "Detail scene", now: new Date().toISOString() });
    commit(next);
    setMode("arrange");
    setSelectedId(undefined);
    setActiveSceneId(scene.id);
    flash(`Created “${scene.name}” detail scene`);
  };
  const openScene = (sceneId: string) => {
    setActiveSceneId(sceneId);
    setSelectedId(undefined);
    setSelectedFocusId(undefined);
    setMode("arrange");
  };
  const backToMain = () => {
    setActiveSceneId("");
    setSelectedId(undefined);
    setMode("arrange");
  };

  // Document operations
  const saveNow = () => {
    const r = saveDraft({ ...doc, updatedAt: new Date().toISOString() });
    setSaveState(r.ok ? "saved" : "unsaved");
    flash(r.ok ? "Saved ✓" : `Save failed: ${r.error}`);
  };
  const resetSceneContext = () => {
    setSelectedId(undefined);
    setSelectedFocusId(undefined);
    setActiveSceneId("");
  };
  const load = () => {
    const r = loadDraft(doc.id);
    if (r.ok && r.doc) {
      setHistory(createHistory(r.doc, 50));
      resetSceneContext();
      flash("Draft loaded");
    } else flash(r.errors.join("; "));
  };
  const reset = () => {
    clearDraft(doc.id);
    setHistory(createHistory(freshDocument(), 50));
    resetSceneContext();
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
      resetSceneContext();
      flash("Imported document");
    } else flash(`Import rejected: ${r.errors.join("; ")}`);
  };

  const setZoomFit = () => setZoom(computeFitZoom());
  const zoomIn = () => setZoom((z) => clampZoom(z + 0.15));
  const zoomOut = () => setZoom((z) => clampZoom(z - 0.15));

  const saveLabel = saveState === "saving" ? "Saving…" : saveState === "unsaved" ? "Unsaved" : saveState === "saved" ? "Saved ✓" : "";

  const ui = (
    <div className="fixed inset-0 z-[110] flex flex-col bg-parchment" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* PREVIEW: the EXACT visitor experience — the same NestSceneNavigator + cinematic
          stage + focus-first resolution. Authored Focus Areas work here just like the
          visitor route (no static stage, no separate preview renderer). */}
      {mode === "preview" ? (
        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-3">
          <button type="button" onClick={exitPreview} className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-ink/85 px-3 py-1.5 text-xs font-bold text-parchment" style={{ marginTop: "env(safe-area-inset-top)" }}>
            <ArrowLeft className="h-4 w-4" /> Edit
          </button>
          {/* Internal debug: reveal focus-area + hotspot regions (template-author/internal only). */}
          {caps.showDebug ? (
            <button type="button" onClick={() => setPreviewHotspots((v) => !v)} aria-pressed={previewHotspots} className={`absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ${previewHotspots ? "bg-teal text-white" : "bg-ink/15 text-ink/60"}`} style={{ marginTop: "env(safe-area-inset-top)" }} title="Internal: show hotspot regions">
              <Eye className="h-4 w-4" /> Hotspots
            </button>
          ) : null}
          <NestSceneNavigator
            key={previewFocusId ?? "preview"}
            doc={doc}
            assetsById={ASSETS}
            interactionsById={GOLDEN_LIVING_NEST_INTERACTIONS_BY_ID}
            baseTemplate={GOLDEN_LIVING_NEST_TEMPLATE}
            debug={previewHotspots}
            autoEnterFocusId={previewFocusId}
          />
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
              <button type="button" onClick={() => setShowPublish(true)} className="ml-1 inline-flex h-9 items-center gap-1 rounded-full bg-[#d9913c] px-3 text-xs font-bold text-white hover:brightness-95"><Upload className="h-4 w-4" /> Publish</button>
              <button type="button" onClick={() => { saveNow(); window.location.href = "/design"; }} className="ml-1 inline-flex h-9 items-center gap-1 rounded-full bg-ink px-3 text-xs font-bold text-parchment hover:bg-ink/85"><Check className="h-4 w-4" /> Done</button>
            </div>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImportFile(f); e.target.value = ""; }} />
          </header>

          {/* Canvas area (hero) */}
          <div className="relative min-h-0 flex-1">
            {/* Scene context — which scene the creator is editing (Main vs a Detail Scene). */}
            <div className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2">
              {isMainActive ? (
                <span className="rounded-full border border-ink/10 bg-parchment/90 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-ink/55 shadow-sm backdrop-blur">Main Nest</span>
              ) : (
                <button type="button" onClick={backToMain} className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-cobalt/30 bg-parchment/95 px-3 py-1 text-[11px] font-bold text-cobalt shadow-sm backdrop-blur">
                  <ArrowLeft className="h-3.5 w-3.5" /> Main Nest <span className="text-ink/40">/</span> {activeScene?.name ?? "Detail"}
                </button>
              )}
            </div>

            <EditorCanvas
              doc={activeDoc}
              assetsById={ASSETS}
              ambience={ambience}
              selectedId={mode === "focus" ? undefined : selectedId}
              onSelect={(id) => { setSelectedId(id); setSelectedSurfaceId(undefined); if (id) { setSelectedInheritedId(undefined); setSelectedInheritedHotspotId(undefined); } }}
              onCommit={commitActive}
              surface={mode === "surface"}
              selectedSurfaceId={selectedSurfaceId}
              onSelectSurface={setSelectedSurfaceId}
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
              backgroundNode={backgroundNode}
              foregroundNode={foregroundNode}
            />

            {/* Focus mode authoring overlay (Main scene only) — one fixed-ratio rectangle.
                The host is pointer-events-none so the canvas is never blocked. */}
            {mode === "focus" && isMainActive ? (
              <FocusEditorOverlay
                focusAreas={focusAreas}
                selectedId={selectedFocusId}
                onSelect={setSelectedFocusId}
                onCommit={onCommitFocusGeometry}
                advanced={caps.showPrecision}
              />
            ) : null}

            {/* Small placeholder indicator on the selected asset (details in Advanced). */}
            {selectedIsPlaceholder && mode === "arrange" ? (
              <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-1 text-[10px] font-bold text-amber-900 shadow" title="Placeholder art (not production-ready)">
                <TriangleAlert className="h-3 w-3" /> placeholder
              </span>
            ) : null}

            {/* Actionable support-surface suggestion (one-tap, undoable) — Phase 11. */}
            {supportSuggestion && mode === "arrange" ? (
              <button type="button" onClick={onPlaceOnSupport} className="absolute bottom-11 left-1/2 z-20 -translate-x-1/2 rounded-full border border-meadow-shade/40 bg-meadow/20 px-3 py-1 text-[11px] font-bold text-meadow-shade shadow">
                Place on {ASSETS[supportSuggestion.assetId]?.name ?? "surface"}
              </button>
            ) : null}

            {/* Contextual advisory warning chip for the selected object (gentle nudge). */}
            {selectedWarnings.length ? (
              <button type="button" onClick={() => caps.showPrecision && setAdvancedOpen(true)} className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full border border-amber-400/50 bg-amber-50/95 px-3 py-1 text-[11px] font-bold text-amber-800 shadow">
                {selectedWarnings[0].message}{caps.showPrecision ? " · Details" : ""}
              </button>
            ) : null}

            {/* Asset drawer — shared bottom sheet (canvas remains visible above) */}
            {mode === "assets" ? (
              <AssetDrawer assets={trayAssets} advanced={caps.showProductionWarnings} onAdd={onAdd} onClose={() => setMode("arrange")} snap={assetSnap} onSnapChange={setAssetSnap} />
            ) : null}

            {/* Connect hint / binding sheet — shared bottom sheet (canvas stays interactive) */}
            {mode === "connect" ? (
              selectedInherited ? (
                // Inherited parent object: same binding UI, but commits a CHILD OVERRIDE.
                // `advanced={false}` keeps geometry/add/delete hidden (geometry is read-only).
                <HotspotBindingSheet
                  object={{
                    instanceId: selectedInherited.derivedId,
                    assetId: selectedInherited.assetId,
                    x: selectedInherited.childBounds.x,
                    y: selectedInherited.childBounds.y,
                    width: selectedInherited.childBounds.width,
                    height: selectedInherited.childBounds.height,
                    anchor: { x: 0.5, y: 1 },
                    plane: "front_wall",
                    zIndex: selectedInherited.zIndex,
                    hotspots: selectedInherited.hotspots,
                    locked: true,
                  }}
                  assetName={`${ASSETS[selectedInherited.assetId]?.name ?? selectedInherited.assetId} · inherited`}
                  selectedHotspotId={selectedInheritedHotspotId}
                  advanced={false}
                  snap={connectSnap}
                  onSnapChange={setConnectSnap}
                  onSelectHotspot={setSelectedInheritedHotspotId}
                  onCommit={commitInheritedBindings}
                  onClose={() => { setSelectedInheritedId(undefined); setSelectedInheritedHotspotId(undefined); }}
                  onSaved={() => { flash("Saved ✓"); setSelectedInheritedId(undefined); setSelectedInheritedHotspotId(undefined); }}
                />
              ) : selected ? (
                <HotspotBindingSheet
                  object={selected}
                  assetName={ASSETS[selected.assetId]?.name ?? selected.assetId}
                  selectedHotspotId={selectedHotspotId}
                  advanced={caps.authorHotspots}
                  snap={connectSnap}
                  onSnapChange={setConnectSnap}
                  onSelectHotspot={setSelectedHotspotId}
                  onCommit={commitHotspots}
                  onClose={() => { setSelectedId(undefined); setSelectedHotspotId(undefined); }}
                  onSaved={() => { flash("Saved ✓"); setSelectedId(undefined); setSelectedHotspotId(undefined); }}
                />
              ) : (
                <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-teal/30 bg-parchment/95 px-4 py-2 text-xs font-bold text-ink/70 shadow">
                  Tap an object{inheritedObjects.length ? " (or the TV/frame in the crop)" : ""} to connect its interactions
                </div>
              )
            ) : null}

            {/* Surface mode — personalise an asset's editable surfaces (M8) */}
            {mode === "surface" ? (
              selectedSurface ? (
                <SurfaceEditorSheet
                  surface={selectedSurface}
                  assetName={selected ? ASSETS[selected.assetId]?.name ?? selected.assetId : "Asset"}
                  snap={surfaceSnap}
                  onSnapChange={setSurfaceSnap}
                  onCommit={onCommitSurface}
                  onClose={() => setSelectedSurfaceId(undefined)}
                  onSaved={() => { flash("Saved ✓"); setSelectedSurfaceId(undefined); }}
                />
              ) : (
                <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-saffron/40 bg-parchment/95 px-4 py-2 text-xs font-bold text-ink/70 shadow">
                  {selected ? "Tap a highlighted surface to personalise it" : "Tap an asset with a screen, photo or cover"}
                </div>
              )
            ) : null}

            {/* Focus mode — area authoring sheet (Main scene only) */}
            {mode === "focus" && isMainActive ? (
              <FocusSheet
                focusAreas={focusAreas}
                selectedFocusId={selectedFocusId}
                scenesById={Object.fromEntries((doc.detailScenes ?? []).map((s) => [s.id, s]))}
                advanced={caps.showPrecision}
                snap={focusSnap}
                onSnapChange={setFocusSnap}
                onClose={() => setMode("arrange")}
                onSelectFocus={setSelectedFocusId}
                onAddFocus={onAddFocus}
                onPatch={onPatchFocus}
                onDelete={onDeleteFocus}
                onCreateScene={onCreateSceneForFocus}
                onOpenScene={openScene}
                onEnterArea={selectedFocus ? onEnterArea : undefined}
                onReset={selectedFocus ? onResetFocus : undefined}
              />
            ) : null}
          </div>

          {/* Bottom command bar (~60px) */}
          <nav className="flex h-16 shrink-0 items-center justify-around gap-1 border-t border-ink/10 px-3 py-1.5">
            <ModeBtn active={mode === "arrange"} label="Arrange" onClick={() => setMode("arrange")}><Move className="h-5 w-5" /></ModeBtn>
            <ModeBtn active={mode === "assets"} label="Assets" onClick={() => { setSelectedId(undefined); setMode("assets"); }}><LayoutGrid className="h-5 w-5" /></ModeBtn>
            <ModeBtn active={mode === "connect"} label="Connect" onClick={() => { setSelectedHotspotId(undefined); setMode("connect"); }}><Link2 className="h-5 w-5" /></ModeBtn>
            {/* Focus mode is Main-scene only (one navigation level — no nested focus). */}
            {isMainActive ? (
              <ModeBtn active={mode === "focus"} label="Focus" onClick={() => { setSelectedId(undefined); setSelectedHotspotId(undefined); setMode("focus"); }}><Maximize2 className="h-5 w-5" /></ModeBtn>
            ) : null}
            <ModeBtn active={mode === "surface"} label="Surface" onClick={() => { setSelectedHotspotId(undefined); setSelectedSurfaceId(undefined); setMode("surface"); }}><ImagePlus className="h-5 w-5" /></ModeBtn>
            <ModeBtn active={false} label="Preview" onClick={onPreview}><Play className="h-5 w-5" /></ModeBtn>
          </nav>
        </>
      )}

      {/* Advanced sheet (internal precision controls — hidden by default) */}
      {advancedOpen && mode !== "connect" && mode !== "focus" && caps.showPrecision ? (
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

      {showPublish ? <PublishGate documentId={documentId} objects={doc.objects} onClose={() => setShowPublish(false)} /> : null}
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
