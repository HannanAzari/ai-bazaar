"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  BarChart3,
  ChevronsDown,
  ChevronsUp,
  Copy,
  DoorOpen,
  Eye,
  EyeOff,
  Home,
  LayoutTemplate,
  Loader2,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Star,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { RoomCanvas } from "@/components/room/room-canvas";
import { ObjectActionModal } from "@/components/room/object-action-modal";
import { ActionDataEditor } from "@/components/room/action-data-editor";
import { objectIcon } from "@/components/room/room-object";
import { forgetHouse, loadHouse, persistHouse } from "@/lib/house-store";
import { type RoomInsights, getRoomInsights } from "@/lib/room-insights";
import {
  addRoom,
  canDeleteRoom,
  createNamedRoom,
  deleteRoom,
  deriveDefaultHouse,
  renameRoom,
  roomLinkTargets,
  setEntryRoom,
  updateRoomMeta,
  withRoom,
} from "@/lib/house";
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
import { ROOM_PRESETS, ROOM_TEMPLATES, type RoomPresetId, type RoomTemplateId, applyTemplate, buildPresetRoom } from "@/lib/room-templates";
import { ROOM_BACKGROUNDS, ROOM_BACKGROUND_IDS, roomBackground } from "@/lib/room-visuals";
import {
  ROOM_ACTION_TYPES,
  actionLabels,
  addObjectFromAsset,
  bringForward,
  deleteObject,
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
import type { HouseRooms, Room, RoomActionType, RoomKind, RoomObject, RoomZoneType, Shop } from "@/lib/types";
import { cn } from "@/lib/utils";

type SaveStatus = "saved" | "saving" | "unsaved";
const AUTOSAVE_MS = 5000;

// Room-type choices for the room manager (the V4 set).
const ROOM_TYPES: { value: RoomKind; label: string }[] = [
  { value: "living_room", label: "Living room" },
  { value: "gallery", label: "Gallery" },
  { value: "studio", label: "Studio" },
  { value: "shop", label: "Shop" },
  { value: "office", label: "Office" },
  { value: "bedroom", label: "Bedroom" },
  { value: "garden", label: "Garden" },
  { value: "custom", label: "Custom" },
];

/** Add `delta` degrees and wrap the result into [-180, 180]. */
function rotateDeg(current: number, delta: number): number {
  let next = (current + delta) % 360;
  if (next > 180) next -= 360;
  if (next < -180) next += 360;
  return next;
}

export function RoomEditor({ shop }: { shop: Shop }) {
  const palette = useMemo(() => roomReadyAssets(), []);
  const [history, setHistory] = useState<History<HouseRooms>>(() => createHistory(deriveDefaultHouse(shop)));
  const house = history.present;
  const [activeRoomId, setActiveRoomId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<string | null>(null);
  const [previewAction, setPreviewAction] = useState<RoomObject | null>(null);
  const [insights, setInsights] = useState<RoomInsights | null>(null);

  const activeRoom = house.rooms.find((room) => room.id === activeRoomId) ?? house.rooms[0];
  const activeId = activeRoom.id;

  const presentRef = useRef(house);
  presentRef.current = house;
  const baselineRef = useRef<HouseRooms | null>(null);

  // Load the saved (or derived) house on the client.
  useEffect(() => {
    let active = true;
    loadHouse(shop)
      .then((loaded) => {
        if (!active) return;
        setHistory(createHistory(loaded));
        setActiveRoomId(loaded.entryRoomId);
        setSelectedIds([]);
        setSaveStatus("saved");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [shop]);

  // Owner-facing visitor insights, recomputed when analytics change.
  useEffect(() => {
    const sync = () => setInsights(getRoomInsights(activeRoom, shop.id));
    sync();
    window.addEventListener("ai-bazaar-events-changed", sync);
    return () => window.removeEventListener("ai-bazaar-events-changed", sync);
  }, [shop.id, activeRoom]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 1800);
  };

  // ── History-aware mutation paths (operate on the whole house) ──
  const commit = (next: HouseRooms) => {
    setHistory((h) => pushHistory(h, next));
    setSaveStatus("unsaved");
  };
  const live = (next: HouseRooms) => setHistory((h) => ({ ...h, present: next }));
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

  // Apply an object-level change to the active room → new house.
  const commitRoom = (nextRoom: Room) => commit(withRoom(presentRef.current, nextRoom));
  const liveRoom = (nextRoom: Room) => live(withRoom(presentRef.current, nextRoom));

  const doUndo = () => { setHistory(undo); setSaveStatus("unsaved"); };
  const doRedo = () => { setHistory(redo); setSaveStatus("unsaved"); };

  // ── Keyboard: Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo ──
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
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
      persistHouse(presentRef.current)
        .then(() => setSaveStatus("saved"))
        .catch(() => setSaveStatus("unsaved"));
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [saveStatus, house]);

  const selected = selectedIds.length === 1 ? activeRoom.objects.find((o) => o.id === selectedIds[0]) ?? null : null;
  const selectedAsset = selected ? getAsset(selected.assetId) : undefined;
  const linkTargets = useMemo(() => roomLinkTargets(house, activeId), [house, activeId]);

  // ── Object operations (active room) ──
  const addAsset = (assetId: string) => {
    const asset = getAsset(assetId);
    if (!asset) return;
    const next = addObjectFromAsset(activeRoom, asset);
    if (next.objects.length === activeRoom.objects.length) {
      flash("No free spot for that — clear a zone first.");
      return;
    }
    commitRoom(next);
    setSelectedIds([next.objects[next.objects.length - 1].id]);
    trackEvent("room_object_added", { shopId: shop.id });
  };
  const patchSelected = (patch: Partial<RoomObject>) => {
    if (!selected) return;
    commitRoom(updateObject(activeRoom, selected.id, patch));
  };
  const duplicate = (id: string) => {
    const next = duplicateObject(activeRoom, id);
    commitRoom(next);
    setSelectedIds([next.objects[next.objects.length - 1].id]);
    trackEvent("room_object_added", { shopId: shop.id });
  };
  const performDelete = (ids: string[]) => {
    let next = activeRoom;
    for (const id of ids) next = deleteObject(next, id);
    commitRoom(next);
    ids.forEach(() => trackEvent("room_object_deleted", { shopId: shop.id }));
    setSelectedIds([]);
    setConfirmDelete(null);
    flash(ids.length > 1 ? `Deleted ${ids.length} objects` : "Object deleted");
  };
  const batchLayer = (direction: "forward" | "backward") => {
    let next = activeRoom;
    for (const id of selectedIds) next = direction === "forward" ? bringForward(next, id) : sendBackward(next, id);
    commitRoom(next);
  };
  const chooseTemplate = (id: RoomTemplateId) => {
    const built = applyTemplate(id, shop.address);
    commitRoom({ ...activeRoom, objects: built.objects });
    setSelectedIds([]);
    trackEvent("room_template_applied", { shopId: shop.id });
    flash(`Applied the ${ROOM_TEMPLATES.find((t) => t.id === id)?.name} template`);
  };

  // ── Room manager (house) ──
  const addBlankRoom = () => {
    const room = createNamedRoom(shop.address, "New room", "custom");
    commit(addRoom(presentRef.current, room));
    setActiveRoomId(room.id);
    setSelectedIds([]);
    trackEvent("room_created", { shopId: shop.id });
    flash("Room created");
  };
  const addPresetRoom = (presetId: RoomPresetId) => {
    if (!presetId) return;
    const room = buildPresetRoom(presetId, shop.address);
    commit(addRoom(presentRef.current, room));
    setActiveRoomId(room.id);
    setSelectedIds([]);
    trackEvent("room_created", { shopId: shop.id });
    flash(`Added a ${ROOM_PRESETS.find((p) => p.id === presetId)?.name} room`);
  };
  const requestDeleteRoom = (roomId: string) => {
    const verdict = canDeleteRoom(house, roomId);
    if (!verdict.ok) { flash(verdict.reason ?? "Can't delete that room."); return; }
    setConfirmDeleteRoom(roomId);
  };
  const performDeleteRoom = (roomId: string) => {
    const next = deleteRoom(presentRef.current, roomId);
    commit(next);
    if (activeId === roomId) setActiveRoomId(next.entryRoomId);
    setConfirmDeleteRoom(null);
    setSelectedIds([]);
    trackEvent("room_deleted", { shopId: shop.id });
    flash("Room deleted");
  };
  const switchRoom = (roomId: string) => { setActiveRoomId(roomId); setSelectedIds([]); };

  const saveNow = () => {
    setSaveStatus("saving");
    persistHouse(house).then(() => { setSaveStatus("saved"); flash("House saved"); }).catch(() => { setSaveStatus("unsaved"); flash("Could not save — check your connection."); });
  };
  const reset = () => {
    void forgetHouse(shop.address).catch(() => undefined);
    const fresh = deriveDefaultHouse(shop);
    setHistory(createHistory(fresh));
    setActiveRoomId(fresh.entryRoomId);
    setSelectedIds([]);
    setSaveStatus("saved");
    flash("Reset to the default room");
  };

  const previewActivate = (object: RoomObject) => {
    if (object.actionType === "room_link") {
      const target = object.actionData?.targetRoomId;
      if (target && house.rooms.some((r) => r.id === target)) { setActiveRoomId(target); setSelectedIds([]); }
      return;
    }
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
      {/* ── Left: rooms + templates + palette + inspector ── */}
      <aside className={cn("space-y-4 xl:sticky xl:top-20", view === "preview" && "pointer-events-none opacity-40")}>
        {/* Room manager */}
        <div className="card rounded-[2rem] p-5">
          <p className="eyebrow text-teal"><Home size={13} className="-mt-0.5 mr-1 inline" /> Rooms</p>
          <div className="mt-3 space-y-1.5">
            {house.rooms.map((room) => {
              const isEntry = room.id === house.entryRoomId;
              const isActive = room.id === activeId;
              return (
                <div key={room.id} className={cn("flex items-center gap-1 rounded-xl border px-2 py-1.5", isActive ? "border-terracotta bg-terracotta/5" : "border-ink/10 bg-white")}>
                  <button onClick={() => switchRoom(room.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className={cn("truncate text-sm font-bold", isActive ? "text-terracotta" : "text-ink/70")}>{room.name}</span>
                    {isEntry && <span className="inline-flex items-center gap-0.5 rounded-full bg-saffron/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700">Entry</span>}
                  </button>
                  <button onClick={() => commit(setEntryRoom(presentRef.current, room.id))} disabled={isEntry} aria-label="Set as entry room" title="Set as entry room" className="grid size-7 place-items-center rounded-lg text-ink/40 enabled:hover:text-saffron disabled:opacity-30"><Star size={13} fill={isEntry ? "currentColor" : "none"} /></button>
                  <button onClick={() => requestDeleteRoom(room.id)} disabled={house.rooms.length <= 1} aria-label="Delete room" title="Delete room" className="grid size-7 place-items-center rounded-lg text-ink/40 enabled:hover:text-terracotta disabled:opacity-30"><Trash2 size={13} /></button>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={addBlankRoom} className="inline-flex items-center gap-1 rounded-lg border border-ink/10 bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink/60 hover:border-terracotta hover:text-terracotta"><Plus size={13} /> Blank room</button>
            <select aria-label="Add a room from a preset" defaultValue="" onChange={(e) => { addPresetRoom(e.target.value as RoomPresetId); e.currentTarget.value = ""; }} className="min-h-8 flex-1 rounded-lg border border-ink/10 bg-white px-2 text-[11px] font-bold text-ink/60">
              <option value="" disabled>+ Add room preset…</option>
              {ROOM_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
            </select>
          </div>

          {/* Active room meta */}
          <div className="mt-4 space-y-2 border-t border-ink/10 pt-3">
            <label className="block text-xs font-black uppercase tracking-wider text-ink/45">Room name
              <input value={activeRoom.name} onChange={(e) => commit(renameRoom(presentRef.current, activeId, e.target.value))} className="mt-1.5 min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal" />
            </label>
            <label className="block text-xs font-black uppercase tracking-wider text-ink/45">Room type
              <select value={activeRoom.type} onChange={(e) => commit(updateRoomMeta(presentRef.current, activeId, { type: e.target.value as RoomKind }))} className="mt-1.5 min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink">
                {ROOM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                {!ROOM_TYPES.some((t) => t.value === activeRoom.type) && <option value={activeRoom.type}>{activeRoom.type}</option>}
              </select>
            </label>
            <label className="block text-xs font-black uppercase tracking-wider text-ink/45">Background
              <select value={roomBackground(activeRoom.background).id} onChange={(e) => commit(updateRoomMeta(presentRef.current, activeId, { background: e.target.value }))} className="mt-1.5 min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink">
                {ROOM_BACKGROUND_IDS.map((id) => <option key={id} value={id}>{ROOM_BACKGROUNDS[id].label}</option>)}
              </select>
            </label>
          </div>
        </div>

        {/* Object templates (apply to the active room) */}
        <div className="card rounded-[2rem] p-5">
          <p className="eyebrow text-teal"><LayoutTemplate size={13} className="-mt-0.5 mr-1 inline" /> Furnish this room</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {ROOM_TEMPLATES.map((template) => (
              <button key={template.id} onClick={() => chooseTemplate(template.id)} title={template.description} className="rounded-2xl border border-ink/10 bg-white px-2.5 py-2.5 text-left text-xs font-bold text-ink/70 shadow-sm transition hover:-translate-y-0.5 hover:border-terracotta hover:text-terracotta">
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
                  const zone = findZone(activeRoom, zoneId);
                  commitRoom(moveObject(activeRoom, selected.id, zoneId, zone?.anchors[0].id ?? selected.anchorId));
                }}
                className="mt-1.5 min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink"
              >
                {(selectedAsset.compatibleZones ?? []).map((zoneType: RoomZoneType) => (
                  <option key={zoneType} value={zoneType}>{zoneLabels[zoneType]}</option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-black uppercase tracking-wider text-ink/45">Anchor point
              <select value={selected.anchorId} onChange={(e) => commitRoom(moveObject(activeRoom, selected.id, selected.zoneId, e.target.value))} className="mt-1.5 min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink">
                {(findZone(activeRoom, selected.zoneId)?.anchors ?? []).map((anchor, index) => (
                  <option key={anchor.id} value={anchor.id}>Spot {index + 1}</option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-black uppercase tracking-wider text-ink/45">Action
              <select value={selected.actionType} onChange={(e) => patchSelected({ actionType: e.target.value as RoomActionType })} className="mt-1.5 min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink">
                {ROOM_ACTION_TYPES.map((action) => <option key={action} value={action}>{actionLabels[action]}</option>)}
              </select>
            </label>

            <ActionDataEditor actionType={selected.actionType} data={selected.actionData ?? {}} onChange={(data) => patchSelected({ actionData: data })} rooms={linkTargets} />

            <label className="block text-xs font-black uppercase tracking-wider text-ink/45">Scale
              <input
                type="range"
                min={0.6}
                max={1.8}
                step={0.05}
                value={selected.scale}
                onPointerDown={interactionStart}
                onChange={(e) => liveRoom(resizeObject(activeRoom, selected.id, { scale: Number(e.target.value) }))}
                onPointerUp={() => commitInteraction("resized")}
                onKeyUp={() => commitInteraction("resized")}
                className="mt-1.5 w-full"
              />
            </label>

            <div>
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-ink/45">
                <span>Rotation</span>
                <span className="normal-case tracking-normal text-ink/40">{Math.round(selected.rotation)}°</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <button onClick={() => commitRoom(updateObject(activeRoom, selected.id, { rotation: rotateDeg(selected.rotation, -15) }))} aria-label="Rotate left" className="grid size-9 shrink-0 place-items-center rounded-lg border border-ink/10 text-ink/60 hover:border-terracotta hover:text-terracotta"><RotateCcw size={15} /></button>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={5}
                  value={selected.rotation}
                  onPointerDown={interactionStart}
                  onChange={(e) => liveRoom(updateObject(activeRoom, selected.id, { rotation: Number(e.target.value) }))}
                  onPointerUp={() => commitInteraction("resized")}
                  onKeyUp={() => commitInteraction("resized")}
                  className="w-full"
                />
                <button onClick={() => commitRoom(updateObject(activeRoom, selected.id, { rotation: rotateDeg(selected.rotation, 15) }))} aria-label="Rotate right" className="grid size-9 shrink-0 place-items-center rounded-lg border border-ink/10 text-ink/60 hover:border-terracotta hover:text-terracotta"><RotateCw size={15} /></button>
              </div>
            </div>
            <p className="-mt-1 text-[10px] text-ink/40">Tip: drag the object to move it; drag a corner handle to resize.</p>

            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => commitRoom(bringForward(activeRoom, selected.id))} className="inline-flex items-center gap-1 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[11px] font-bold text-ink/60 hover:border-terracotta hover:text-terracotta"><ChevronsUp size={13} /> Forward</button>
              <button onClick={() => commitRoom(sendBackward(activeRoom, selected.id))} className="inline-flex items-center gap-1 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[11px] font-bold text-ink/60 hover:border-terracotta hover:text-terracotta"><ChevronsDown size={13} /> Backward</button>
              <button onClick={() => patchSelected({ hidden: !selected.hidden })} className="inline-flex items-center gap-1 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[11px] font-bold text-ink/60 hover:border-terracotta hover:text-terracotta">{selected.hidden ? <><Eye size={13} /> Show</> : <><EyeOff size={13} /> Hide</>}</button>
              <button onClick={() => duplicate(selected.id)} className="inline-flex items-center gap-1 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[11px] font-bold text-ink/60 hover:border-terracotta hover:text-terracotta"><Copy size={13} /> Duplicate</button>
              <button onClick={() => setConfirmDelete([selected.id])} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-[11px] font-bold text-terracotta hover:bg-rose-50"><Trash2 size={13} /> Delete</button>
            </div>
          </div>
        ) : (
          <div className="card rounded-[2rem] p-5 text-sm text-ink/50">Tap an object to select it, drag to move, or drag a box on empty floor to select several. Add a <span className="inline-flex items-center gap-0.5 font-bold text-ink/70"><DoorOpen size={12} /> Door</span> to link rooms.</div>
        )}
      </aside>

      {/* ── Right: canvas + controls ── */}
      <div className="min-w-0">
        {/* Toolbar */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex rounded-full bg-white/70 p-1 shadow-sm">
              <button onClick={() => setView("edit")} className={cn("flex min-h-9 items-center gap-1.5 rounded-full px-4 text-sm font-black", view === "edit" ? "bg-ink text-white" : "text-ink/50")}><Pencil size={14} /> Edit</button>
              <button onClick={() => { setSelectedIds([]); setView("preview"); }} className={cn("flex min-h-9 items-center gap-1.5 rounded-full px-4 text-sm font-black", view === "preview" ? "bg-teal text-white" : "text-ink/50")}><Eye size={14} /> Preview</button>
            </div>
            <span className="text-xs font-bold text-ink/45">Editing: <span className="text-ink/70">{activeRoom.name}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={doUndo} disabled={!canUndo(history)} aria-label="Undo" title="Undo (⌘Z)" className="grid size-9 place-items-center rounded-full border border-ink/15 bg-white text-ink/60 transition enabled:hover:border-terracotta enabled:hover:text-terracotta disabled:opacity-35"><Undo2 size={16} /></button>
            <button onClick={doRedo} disabled={!canRedo(history)} aria-label="Redo" title="Redo (⌘⇧Z)" className="grid size-9 place-items-center rounded-full border border-ink/15 bg-white text-ink/60 transition enabled:hover:border-terracotta enabled:hover:text-terracotta disabled:opacity-35"><Redo2 size={16} /></button>
          </div>
        </div>

        <div className="relative h-[60vh] min-h-[460px] overflow-hidden rounded-[2.75rem] border-[10px] border-white/65">
          {view === "edit" ? (
            <RoomCanvas
              room={activeRoom}
              mode="editor"
              editor={{
                selectedIds,
                onSelectionChange: setSelectedIds,
                onInteractionStart: interactionStart,
                onLiveChange: liveRoom,
                onCommit: commitInteraction,
              }}
            />
          ) : (
            <RoomCanvas room={activeRoom} mode="public" ownerName={shop.owner} onActivate={previewActivate} />
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className={cn("flex items-center gap-2 text-xs font-bold", saveStatus === "saved" ? "text-emerald-700" : saveStatus === "saving" ? "text-ink/45" : "text-terracotta")}>
            {saveStatus === "saving" ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownToLine size={14} />} {statusLabel}
          </span>
          <div className="flex gap-2">
            <button onClick={reset} className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-bold text-ink/60 hover:border-terracotta hover:text-terracotta"><RotateCcw size={15} /> Reset house</button>
            <button onClick={saveNow} className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#9a4a30]"><Save size={15} /> Save house</button>
          </div>
        </div>

        {/* ── Owner room insights (visitor journey) ── */}
        <div className="card mt-4 rounded-[2rem] p-5">
          <p className="eyebrow text-teal"><BarChart3 size={13} className="-mt-0.5 mr-1 inline" /> Room insights · {activeRoom.name}</p>
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

      {/* ── Delete object confirmation ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-ink/40 p-5 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm rounded-[2rem] border border-white/70 bg-[#fff8e9] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="grid size-11 place-items-center rounded-2xl bg-rose-100 text-terracotta"><TriangleAlert size={22} /></span>
            <h2 className="display mt-3 text-2xl">Delete {confirmDelete.length > 1 ? `${confirmDelete.length} objects` : "this object"}?</h2>
            <p className="mt-2 text-sm text-ink/55">This removes {confirmDelete.length > 1 ? "them" : "it"} from this room. You can undo with ⌘Z.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-bold text-ink/60 hover:border-ink/30">Cancel</button>
              <button onClick={() => performDelete(confirmDelete)} className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-bold text-white hover:bg-[#9a4a30]"><Trash2 size={15} /> Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete room confirmation ── */}
      {confirmDeleteRoom && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-ink/40 p-5 backdrop-blur-sm" onClick={() => setConfirmDeleteRoom(null)}>
          <div className="w-full max-w-sm rounded-[2rem] border border-white/70 bg-[#fff8e9] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="grid size-11 place-items-center rounded-2xl bg-rose-100 text-terracotta"><TriangleAlert size={22} /></span>
            <h2 className="display mt-3 text-2xl">Delete this room?</h2>
            <p className="mt-2 text-sm text-ink/55">Removes “{house.rooms.find((r) => r.id === confirmDeleteRoom)?.name}” from your house. Doors that pointed at it will be cleared. You can undo with ⌘Z.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteRoom(null)} className="rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-bold text-ink/60 hover:border-ink/30">Cancel</button>
              <button onClick={() => performDeleteRoom(confirmDeleteRoom)} className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-bold text-white hover:bg-[#9a4a30]"><Trash2 size={15} /> Delete room</button>
            </div>
          </div>
        </div>
      )}

      {previewAction && <ObjectActionModal object={previewAction} shop={shop} onClose={() => setPreviewAction(null)} />}
    </div>
  );
}
