"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ChevronsDown, ChevronsUp, Copy, Eye, EyeOff, RotateCcw, Save, Trash2 } from "lucide-react";
import { RoomCanvas } from "@/components/room/room-canvas";
import { objectIcon } from "@/components/room/room-object";
import { getRoom, resetRoom, saveRoom } from "@/lib/room";
import {
  ROOM_ACTION_TYPES,
  actionLabels,
  addObjectFromAsset,
  bringToFront,
  deleteObject,
  deriveDefaultRoom,
  duplicateObject,
  findZone,
  moveObject,
  sendToBack,
  updateObject,
  zoneLabels,
} from "@/lib/room-schema";
import { getAsset, roomReadyAssets } from "@/lib/assets";
import type { Room, RoomActionType, RoomObject, RoomZoneType, Shop } from "@/lib/types";

const URL_ACTIONS: RoomActionType[] = ["link", "video", "product", "booking", "gallery"];

export function RoomEditor({ shop }: { shop: Shop }) {
  const palette = useMemo(() => roomReadyAssets(), []);
  const [room, setRoom] = useState<Room>(() => deriveDefaultRoom(shop));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setRoom(getRoom(shop));
  }, [shop]);

  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 1600); };
  const apply = (next: Room) => { setRoom(next); setDirty(true); };

  const selected = room.objects.find((o) => o.id === selectedId) ?? null;
  const selectedAsset = selected ? getAsset(selected.assetId) : undefined;

  const addAsset = (assetId: string) => {
    const asset = getAsset(assetId);
    if (!asset) return;
    const before = room.objects.length;
    const next = addObjectFromAsset(room, asset);
    if (next.objects.length === before) {
      flash("No free spot for that — clear a zone first.");
      return;
    }
    apply(next);
    setSelectedId(next.objects[next.objects.length - 1].id);
  };

  const patchSelected = (patch: Partial<RoomObject>) => {
    if (!selected) return;
    apply(updateObject(room, selected.id, patch));
  };

  const save = () => { saveRoom(room); setDirty(false); flash("Room layout saved"); };
  const reset = () => {
    resetRoom(shop.address);
    const fresh = deriveDefaultRoom(shop);
    setRoom(fresh);
    setSelectedId(null);
    setDirty(false);
    flash("Reset to the default room");
  };

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      {/* ── Left: palette + inspector ── */}
      <aside className="space-y-4 xl:sticky xl:top-20">
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

        {selected && selectedAsset ? (
          <div className="card space-y-3 rounded-[2rem] p-5">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-terracotta">Selected object</p>
              <button onClick={() => setSelectedId(null)} className="text-xs font-bold text-ink/40 hover:text-terracotta">Deselect</button>
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
                  apply(moveObject(room, selected.id, zoneId, zone?.anchors[0].id ?? selected.anchorId));
                }}
                className="mt-1.5 min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink"
              >
                {(selectedAsset.compatibleZones ?? []).map((zoneType: RoomZoneType) => (
                  <option key={zoneType} value={zoneType}>{zoneLabels[zoneType]}</option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-black uppercase tracking-wider text-ink/45">Anchor point
              <select value={selected.anchorId} onChange={(e) => apply(moveObject(room, selected.id, selected.zoneId, e.target.value))} className="mt-1.5 min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink">
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

            {URL_ACTIONS.includes(selected.actionType) && (
              <label className="block text-xs font-black uppercase tracking-wider text-ink/45">Link / URL
                <input value={selected.actionData?.url ?? ""} onChange={(e) => patchSelected({ actionData: { ...selected.actionData, url: e.target.value } })} placeholder="https://…" className="mt-1.5 min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal" />
              </label>
            )}

            <label className="block text-xs font-black uppercase tracking-wider text-ink/45">Scale
              <input type="range" min={0.7} max={1.6} step={0.1} value={selected.scale} onChange={(e) => patchSelected({ scale: Number(e.target.value) })} className="mt-1.5 w-full" />
            </label>

            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => apply(bringToFront(room, selected.id))} className="inline-flex items-center gap-1 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[11px] font-bold text-ink/60 hover:border-terracotta hover:text-terracotta"><ChevronsUp size={13} /> Front</button>
              <button onClick={() => apply(sendToBack(room, selected.id))} className="inline-flex items-center gap-1 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[11px] font-bold text-ink/60 hover:border-terracotta hover:text-terracotta"><ChevronsDown size={13} /> Back</button>
              <button onClick={() => patchSelected({ hidden: !selected.hidden })} className="inline-flex items-center gap-1 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[11px] font-bold text-ink/60 hover:border-terracotta hover:text-terracotta">{selected.hidden ? <><Eye size={13} /> Show</> : <><EyeOff size={13} /> Hide</>}</button>
              <button onClick={() => { const next = duplicateObject(room, selected.id); apply(next); setSelectedId(next.objects[next.objects.length - 1].id); }} className="inline-flex items-center gap-1 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[11px] font-bold text-ink/60 hover:border-terracotta hover:text-terracotta"><Copy size={13} /> Duplicate</button>
              <button onClick={() => { apply(deleteObject(room, selected.id)); setSelectedId(null); }} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-[11px] font-bold text-terracotta hover:bg-rose-50"><Trash2 size={13} /> Delete</button>
            </div>
          </div>
        ) : (
          <div className="card rounded-[2rem] p-5 text-sm text-ink/50">Tap an object in the room to select and edit it.</div>
        )}
      </aside>

      {/* ── Right: canvas + save/reset ── */}
      <div className="min-w-0">
        <div className="relative h-[60vh] min-h-[460px] overflow-hidden rounded-[2.75rem] border-[10px] border-white/65">
          <RoomCanvas room={room} mode="editor" selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs font-bold text-ink/45">
            <ArrowDownToLine size={14} /> {dirty ? "Unsaved changes" : "Layout saved"}
          </span>
          <div className="flex gap-2">
            <button onClick={reset} className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-bold text-ink/60 hover:border-terracotta hover:text-terracotta"><RotateCcw size={15} /> Reset layout</button>
            <button onClick={save} className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#9a4a30]"><Save size={15} /> Save layout</button>
          </div>
        </div>
      </div>
    </div>
  );
}
