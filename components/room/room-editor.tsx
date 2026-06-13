"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  BarChart3,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Eye,
  EyeOff,
  LayoutTemplate,
  Loader2,
  Pencil,
  Redo2,
  RotateCcw,
  Save,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { RoomCanvas } from "@/components/room/room-canvas";
import { ObjectActionModal } from "@/components/room/object-action-modal";
import { ActionDataEditor } from "@/components/room/action-data-editor";
import { objectIcon } from "@/components/room/room-object";
import { getRoom, resetRoom, saveRoom } from "@/lib/room";
import { type RoomInsights, getRoomInsights } from "@/lib/room-insights";
import {
  HISTORY_LIMIT,
  type History,
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redo,
  undo,
} from "@/lib/room-history";
import { ROOM_TEMPLATES, type RoomTemplateId, applyTemplate } from "@/lib/room-templates";
import {
  ROOM_ACTION_TYPES,
  actionLabels,
  addObjectFromAsset,
  bringForward,
  deleteObject,
  deriveDefaultRoom,
  duplicateObject,
  findZone,
  moveObject,
  resizeObject,
  sendBackward,
  updateObject,
  zoneLabels,
} from "@/lib/room-schema";
import { getAsset, roomReadyAssets } from "@/lib/assets";
import { trackEvent } from "@/lib/events";
import type { Room, RoomActionType, RoomObject, RoomZoneType, Shop } from "@/lib/types";
import { cn } from "@/lib/utils";

type SaveStatus = "saved" | "saving" | "unsaved";
const AUTOSAVE_MS = 5000;

export function RoomEditor({ shop }: { shop: Shop }) {
  const palette = useMemo(() => roomReadyAssets(), []);
  const [history, setHistory] = useState<History<Room>>(() => createHistory(deriveDefaultRoom(shop)));
  const room = history.present;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [previewAction, setPreviewAction] = useState<RoomObject | null>(null);
  const [insights, setInsights] = useState<RoomInsights | null>(null);

  const presentRef = useRef(room);
  presentRef.current = room;
  const baselineRef = useRef<Room | null>(null);

  // Load the saved (or derived) room on the client.
  useEffect(() => {
    setHistory(createHistory(getRoom(shop)));
    setSelectedIds([]);
    setSaveStatus("saved");
  }, [shop]);

  // Owner-facing visitor insights, recomputed when analytics change.
  useEffect(() => {
    const sync = () => setInsights(getRoomInsights(presentRef.current, shop.id));
    sync();
    window.addEventListener("ai-bazaar-events-changed", sync);
    return () => window.removeEventListener("ai-bazaar-events-changed", sync);
  }, [shop.id, room]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 1600);
  };

  // ── History-aware mutation paths ──
  // Discrete actions push a new history entry; drags/resizes stream via `live`
  // and push a single entry on release (baseline captured at interaction start).
  const commit = (next: Room) => {
    setHistory((h) => pushHistory(h, next));
    setSaveStatus("unsaved");
  };
  const live = (next: Room) => setHistory((h) => ({ ...h, present: next }));
  const interactionStart = () => {
    baselineRef.current = presentRef.current;
  };
  const commitInteraction = (kind: "moved" | "resized") => {
    const baseline = baselineRef.current;
    baselineRef.current = null;
    setHistory((h) => (baseline ? { past: [...h.past, baseline].slice(-HISTORY_LIMIT), present: h.present, future: [] } : h));
    setSaveStatus("unsaved");
    trackEvent(kind === "moved" ? "room_object_moved" : "room_object_resized", { shopId: shop.id });
  };

  const doUndo = () => {
    setHistory(undo);
    setSaveStatus("unsaved");
  };
  const doRedo = () => {
    setHistory(redo);
    setSaveStatus("unsaved");
  };

  // ── Keyboard: Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo ──
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return; // let native text undo work
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) doRedo();
      else doUndo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Autosave: 5s after the last change ──
  useEffect(() => {
    if (saveStatus !== "unsaved") return;
    const timer = window.setTimeout(() => {
      setSaveStatus("saving");
      saveRoom(presentRef.current);
      window.setTimeout(() => setSaveStatus("saved"), 300);
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [saveStatus, room]);

  const selected = selectedIds.length === 1 ? room.objects.find((o) => o.id === selectedIds[0]) ?? null : null;
  const selectedAsset = selected ? getAsset(selected.assetId) : undefined;

  const addAsset = (assetId: string) => {
    const asset = getAsset(assetId);
    if (!asset) return;
    const next = addObjectFromAsset(room, asset);
    if (next.objects.length === room.objects.length) {
      flash("No free spot for that — clear a zone first.");
      return;
    }
    commit(next);
    setSelectedIds([next.objects[next.objects.length - 1].id]);
    trackEvent("room_object_added", { shopId: shop.id });
  };

  const patchSelected = (patch: Partial<RoomObject>) => {
    if (!selected) return;
    commit(updateObject(room, selected.id, patch));
  };

  const duplicate = (id: string) => {
    const next = duplicateObject(room, id);
    commit(next);
    setSelectedIds([next.objects[next.objects.length - 1].id]);
    trackEvent("room_object_added", { shopId: shop.id });
  };

  const performDelete = (ids: string[]) => {
    let next = room;
    for (const id of ids) next = deleteObject(next, id);
    commit(next);
    ids.forEach(() => trackEvent("room_object_deleted", { shopId: shop.id }));
    setSelectedIds([]);
    setConfirmDelete(null);
    flash(ids.length > 1 ? `Deleted ${ids.length} objects` : "Object deleted");
  };

  const batchLayer = (direction: "forward" | "backward") => {
    let next = room;
    for (const id of selectedIds) next = direction === "forward" ? bringForward(next, id) : sendBackward(next, id);
    commit(next);
  };

  const chooseTemplate = (id: RoomTemplateId) => {
    commit(applyTemplate(id, shop.address));
    setSelectedIds([]);
    trackEvent("room_template_applied", { shopId: shop.id });
    flash(`Applied the ${ROOM_TEMPLATES.find((t) => t.id === id)?.name} template`);
  };

  const saveNow = () => {
    saveRoom(room);
    setSaveStatus("saved");
    flash("Room layout saved");
  };
  const reset = () => {
    resetRoom(shop.address);
    setHistory(createHistory(deriveDefaultRoom(shop)));
    setSelectedIds([]);
    setSaveStatus("saved");
    flash("Reset to the default room");
  };

  const previewActivate = (object: RoomObject) => {
    if (object.actionType === "link") {
      const url = object.actionData?.url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (object.actionType === "guestbook" || object.actionType === "none") return;
    setPreviewAction(object);
  };

  const statusLabel = saveStatus === "saving" ? "Saving…" : saveStatus === "unsaved" ? "Unsaved changes" : "Saved";

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      {/* ── Left: templates + palette + inspector ── */}
      <aside className={cn("space-y-4 xl:sticky xl:top-20", view === "preview" && "pointer-events-none opacity-40")}>
        <div className="card rounded-[2rem] p-5">
          <p className="eyebrow text-teal"><LayoutTemplate size={13} className="-mt-0.5 mr-1 inline" /> Start from a template</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {ROOM_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => chooseTemplate(template.id)}
                title={template.description}
                className="rounded-2xl border border-ink/10 bg-white px-2.5 py-2.5 text-left text-xs font-bold text-ink/70 shadow-sm transition hover:-translate-y-0.5 hover:border-terracotta hover:text-terracotta"
              >
                {template.name}
              </button>
            ))}
          </div>
        </div>

        <div className="card rounded-[2rem] p-5">
          <p className="eyebrow text-teal">Add an object</p>
          <h2 className="mt-1 font-black">Room objects</h2>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {palette.map((asset) => {
              const Icon = objectIcon(asset.id);
              return (
                <button key={asset.id} onClick={() => addAsset(asset.id)} className="flex flex-col items-center gap-1 rounded-2xl border border-ink/10 bg-white p-2.5 text-center text-[10px] font-bold text-ink/60 shadow-sm transition hover:-translate-y-0.5 hover:border-terracotta">
                  <Icon size={20} className="text-terracotta" />
                  <span className="leading-tight">{asset.name}</span>
                </button>
              );
            })}
          </div>
          {notice && <p className="mt-3 text-center text-xs font-bold text-teal">{notice}</p>}
        </div>

        {selectedIds.length > 1 ? (
          <div className="card space-y-3 rounded-[2rem] p-5">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-terracotta">{selectedIds.length} objects selected</p>
              <button onClick={() => setSelectedIds([])} className="text-xs font-bold text-ink/40 hover:text-terracotta">Clear</button>
            </div>
            <p className="text-xs text-ink/50">Drag any selected object to move them together, or:</p>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => batchLayer("forward")} className="inline-flex items-center gap-1 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[11px] font-bold text-ink/60 hover:border-terracotta hover:text-terracotta"><ChevronsUp size={13} /> Forward</button>
              <button onClick={() => batchLayer("backward")} className="inline-flex items-center gap-1 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[11px] font-bold text-ink/60 hover:border-terracotta hover:text-terracotta"><ChevronsDown size={13} /> Backward</button>
              <button onClick={() => setConfirmDelete(selectedIds)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-[11px] font-bold text-terracotta hover:bg-rose-50"><Trash2 size={13} /> Delete all</button>
            </div>
          </div>
        ) : selected && selectedAsset ? (
          <div className="card space-y-3 rounded-[2rem] p-5">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-terracotta">Selected object</p>
              <button onClick={() => setSelectedIds([])} className="text-xs font-bold text-ink/40 hover:text-terracotta">Deselect</button>
            </div>

            <label className="block text-xs font-black uppercase tracking-wider text-ink/45">Label
              <input value={selected.label} onChange={(e) => patchSelected({ label: e.target.value.slice(0, 60) })} className="mt-1.5 min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal" />
            </label>

            <label className="block text-xs font-black uppercase tracking-wider text-ink/45">Zone
              <select
                value={selected.zoneId}
                onChange={(e) => {
                  const zoneId = e.target.value;
                  const zone = findZone(room, zoneId);
                  commit(moveObject(room, selected.id, zoneId, zone?.anchors[0].id ?? selected.anchorId));
                }}
                className="mt-1.5 min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink"
              >
                {(selectedAsset.compatibleZones ?? []).map((zoneType: RoomZoneType) => (
                  <option key={zoneType} value={zoneType}>{zoneLabels[zoneType]}</option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-black uppercase tracking-wider text-ink/45">Anchor point
              <select value={selected.anchorId} onChange={(e) => commit(moveObject(room, selected.id, selected.zoneId, e.target.value))} className="mt-1.5 min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink">
                {(findZone(room, selected.zoneId)?.anchors ?? []).map((anchor, index) => (
                  <option key={anchor.id} value={anchor.id}>Spot {index + 1}</option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-black uppercase tracking-wider text-ink/45">Action
              <select value={selected.actionType} onChange={(e) => patchSelected({ actionType: e.target.value as RoomActionType })} className="mt-1.5 min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink">
                {ROOM_ACTION_TYPES.map((action) => <option key={action} value={action}>{actionLabels[action]}</option>)}
              </select>
            </label>

            <ActionDataEditor actionType={selected.actionType} data={selected.actionData ?? {}} onChange={(data) => patchSelected({ actionData: data })} />

            <label className="block text-xs font-black uppercase tracking-wider text-ink/45">Scale
              <input
                type="range"
                min={0.6}
                max={1.8}
                step={0.05}
                value={selected.scale}
                onPointerDown={interactionStart}
                onChange={(e) => live(resizeObject(room, selected.id, { scale: Number(e.target.value) }))}
                onPointerUp={() => commitInteraction("resized")}
                onKeyUp={() => commitInteraction("resized")}
                className="mt-1.5 w-full"
              />
            </label>
            <p className="-mt-1 text-[10px] text-ink/40">Tip: drag the object to move it; drag a corner handle to resize.</p>

            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => commit(bringForward(room, selected.id))} className="inline-flex items-center gap-1 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[11px] font-bold text-ink/60 hover:border-terracotta hover:text-terracotta"><ChevronsUp size={13} /> Forward</button>
              <button onClick={() => commit(sendBackward(room, selected.id))} className="inline-flex items-center gap-1 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[11px] font-bold text-ink/60 hover:border-terracotta hover:text-terracotta"><ChevronsDown size={13} /> Backward</button>
              <button onClick={() => patchSelected({ hidden: !selected.hidden })} className="inline-flex items-center gap-1 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[11px] font-bold text-ink/60 hover:border-terracotta hover:text-terracotta">{selected.hidden ? <><Eye size={13} /> Show</> : <><EyeOff size={13} /> Hide</>}</button>
              <button onClick={() => duplicate(selected.id)} className="inline-flex items-center gap-1 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[11px] font-bold text-ink/60 hover:border-terracotta hover:text-terracotta"><Copy size={13} /> Duplicate</button>
              <button onClick={() => setConfirmDelete([selected.id])} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-[11px] font-bold text-terracotta hover:bg-rose-50"><Trash2 size={13} /> Delete</button>
            </div>
          </div>
        ) : (
          <div className="card rounded-[2rem] p-5 text-sm text-ink/50">Tap an object to select it, drag to move, or drag a box on empty floor to select several.</div>
        )}
      </aside>

      {/* ── Right: canvas + controls ── */}
      <div className="min-w-0">
        {/* Toolbar */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-full bg-white/70 p-1 shadow-sm">
            <button onClick={() => setView("edit")} className={cn("flex min-h-9 items-center gap-1.5 rounded-full px-4 text-sm font-black", view === "edit" ? "bg-ink text-white" : "text-ink/50")}><Pencil size={14} /> Edit</button>
            <button onClick={() => { setSelectedIds([]); setView("preview"); }} className={cn("flex min-h-9 items-center gap-1.5 rounded-full px-4 text-sm font-black", view === "preview" ? "bg-teal text-white" : "text-ink/50")}><Eye size={14} /> Preview</button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={doUndo} disabled={!canUndo(history)} aria-label="Undo" title="Undo (⌘Z)" className="grid size-9 place-items-center rounded-full border border-ink/15 bg-white text-ink/60 transition enabled:hover:border-terracotta enabled:hover:text-terracotta disabled:opacity-35"><Undo2 size={16} /></button>
            <button onClick={doRedo} disabled={!canRedo(history)} aria-label="Redo" title="Redo (⌘⇧Z)" className="grid size-9 place-items-center rounded-full border border-ink/15 bg-white text-ink/60 transition enabled:hover:border-terracotta enabled:hover:text-terracotta disabled:opacity-35"><Redo2 size={16} /></button>
          </div>
        </div>

        <div className="relative h-[60vh] min-h-[460px] overflow-hidden rounded-[2.75rem] border-[10px] border-white/65">
          {view === "edit" ? (
            <RoomCanvas
              room={room}
              mode="editor"
              editor={{
                selectedIds,
                onSelectionChange: setSelectedIds,
                onInteractionStart: interactionStart,
                onLiveChange: live,
                onCommit: commitInteraction,
              }}
            />
          ) : (
            <RoomCanvas room={room} mode="public" onActivate={previewActivate} />
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className={cn("flex items-center gap-2 text-xs font-bold", saveStatus === "saved" ? "text-emerald-700" : saveStatus === "saving" ? "text-ink/45" : "text-terracotta")}>
            {saveStatus === "saving" ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownToLine size={14} />} {statusLabel}
          </span>
          <div className="flex gap-2">
            <button onClick={reset} className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-bold text-ink/60 hover:border-terracotta hover:text-terracotta"><RotateCcw size={15} /> Reset layout</button>
            <button onClick={saveNow} className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#9a4a30]"><Save size={15} /> Save layout</button>
          </div>
        </div>

        {/* ── Owner room insights (visitor journey) ── */}
        <div className="card mt-4 rounded-[2rem] p-5">
          <p className="eyebrow text-teal"><BarChart3 size={13} className="-mt-0.5 mr-1 inline" /> Room insights</p>
          {insights && insights.totalClicks > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl border border-ink/10 bg-white/60 p-3">
                <strong className="block text-xl">{insights.totalClicks}</strong>
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink/35">Object clicks</span>
              </div>
              <div className="rounded-2xl border border-ink/10 bg-white/60 p-3">
                <strong className="block truncate text-sm">{insights.mostClicked?.label ?? "—"}</strong>
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink/35">Most clicked{insights.mostClicked ? ` · ${insights.mostClicked.count}` : ""}</span>
              </div>
              <div className="rounded-2xl border border-ink/10 bg-white/60 p-3">
                <strong className="block truncate text-sm">{insights.popularType?.label ?? "—"}</strong>
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink/35">Popular type</span>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink/50">No visits yet. Share your room — clicks on its objects will show up here.</p>
          )}
        </div>
      </div>

      {/* ── Delete confirmation ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-ink/40 p-5 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm rounded-[2rem] border border-white/70 bg-[#fff8e9] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="grid size-11 place-items-center rounded-2xl bg-rose-100 text-terracotta"><TriangleAlert size={22} /></span>
            <h2 className="display mt-3 text-2xl">Delete {confirmDelete.length > 1 ? `${confirmDelete.length} objects` : "this object"}?</h2>
            <p className="mt-2 text-sm text-ink/55">This removes {confirmDelete.length > 1 ? "them" : "it"} from your room. You can undo with ⌘Z.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-bold text-ink/60 hover:border-ink/30">Cancel</button>
              <button onClick={() => performDelete(confirmDelete)} className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-bold text-white hover:bg-[#9a4a30]"><Trash2 size={15} /> Delete</button>
            </div>
          </div>
        </div>
      )}

      {previewAction && <ObjectActionModal object={previewAction} shop={shop} onClose={() => setPreviewAction(null)} />}
    </div>
  );
}
