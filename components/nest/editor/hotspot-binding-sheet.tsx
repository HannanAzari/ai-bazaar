"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Link2, Lock, Plus, Square, Trash2, Unlock, X } from "lucide-react";
import type { EditableNestObject } from "@/lib/nest-editor-types";
import type { NestAssetHotspot, NestHotspotSemantic } from "@/lib/nest-hotspot-types";
import { isInternalSemantic, NEST_HOTSPOT_SEMANTICS } from "@/lib/nest-hotspot-types";
import {
  addHotspot,
  clearHotspotBinding,
  removeHotspot,
  setHotspotBinding,
  updateHotspot,
  validateBindingUrl,
} from "@/lib/nest-hotspots";
import { MobileBottomSheet, type BottomSheetSnapPoint } from "@/components/nest/editor/mobile-bottom-sheet";

// The Connect bottom sheet. Normal creators pick a hotspot chip, then choose what it
// opens (a safe link or an internal action) — they never see interaction ids or draw
// regions. Advanced authors get add rect/ellipse, rename, semantic, lock, enable, and
// delete (move/resize happen on the canvas). Raw JSON is never shown.

const PLACEHOLDER: Partial<Record<NestHotspotSemantic, string>> = {
  video: "https://youtube.com/watch?v=…",
  music: "https://open.spotify.com/…",
  podcast: "https://…",
  website: "https://example.com",
  article: "https://example.com/post",
  gallery: "https://example.com/gallery",
  shop: "https://shop.example.com",
  custom_link: "https://example.com",
};

function hotspotState(h: NestAssetHotspot): { label: string; tone: string } {
  if (!h.enabled) return { label: "Off", tone: "bg-ink/10 text-ink/45" };
  if (isInternalSemantic(h.semantic)) return { label: "Action", tone: "bg-teal/15 text-teal" };
  if (h.binding?.url) return { label: "Linked", tone: "bg-meadow/20 text-meadow-shade" };
  return { label: "Not set", tone: "bg-amber-400/20 text-amber-800" };
}

export function HotspotBindingSheet({
  object,
  assetName,
  selectedHotspotId,
  advanced,
  snap,
  onSnapChange,
  onSelectHotspot,
  onCommit,
  onClose,
}: {
  object: EditableNestObject;
  assetName: string;
  selectedHotspotId?: string;
  advanced: boolean;
  snap: BottomSheetSnapPoint;
  onSnapChange: (s: BottomSheetSnapPoint) => void;
  onSelectHotspot: (id: string | undefined) => void;
  onCommit: (hotspots: NestAssetHotspot[]) => void;
  onClose: () => void;
}) {
  const hotspots = object.hotspots ?? [];
  const selected = hotspots.find((h) => h.id === selectedHotspotId);

  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUrl(selected?.binding?.url ?? "");
    setLabel(selected?.binding?.label ?? selected?.name ?? "");
    setError(null);
  }, [selectedHotspotId, selected?.binding?.url, selected?.binding?.label, selected?.name]);

  const internal = selected ? isInternalSemantic(selected.semantic) : false;
  const placeholder = useMemo(() => (selected ? PLACEHOLDER[selected.semantic] ?? "https://…" : ""), [selected]);

  function connect() {
    if (!selected) return;
    if (!internal) {
      const check = validateBindingUrl(url);
      if (!check.ok) {
        setError(check.error ?? "Invalid URL");
        return;
      }
    } else if (url) {
      const check = validateBindingUrl(url);
      if (!check.ok) {
        setError(check.error ?? "Invalid URL");
        return;
      }
    }
    setError(null);
    onCommit(setHotspotBinding(hotspots, selected.id, { type: selected.semantic, url: url || undefined, label: label || selected.name }));
  }
  function remove() {
    if (!selected) return;
    onCommit(clearHotspotBinding(hotspots, selected.id));
  }
  function patch(p: Partial<NestAssetHotspot>) {
    if (!selected) return;
    onCommit(updateHotspot(hotspots, selected.id, p));
  }
  function addShape(type: "rect" | "ellipse") {
    const r = addHotspot(hotspots, { name: type === "rect" ? "New region" : "New area", semantic: "website", shape: { type, x: 0.35, y: 0.35, width: 0.3, height: 0.3 }, idBase: `${object.instanceId}-custom`, authoringMode: "custom" });
    onCommit(r.hotspots);
    onSelectHotspot(r.id);
  }

  // Opening the keyboard (focusing a field) should reveal the form — expand the sheet.
  const expand = () => onSnapChange("expanded");

  const header = (
    <div className="px-3 pb-1 pt-1">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-teal">Connect</p>
          <h3 className="display truncate text-base leading-tight text-ink">{assetName}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink/55 hover:bg-ink/5"><X className="h-5 w-5" /></button>
      </div>
    </div>
  );

  return (
    <MobileBottomSheet open snap={snap} onSnapChange={onSnapChange} onClose={onClose} backdrop="none" label={`Connect ${assetName}`} header={header}>
      <div className="px-3 pb-4 pt-1">
        {/* Hotspot chips (segmented) */}
        {hotspots.length ? (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {hotspots.map((h) => {
              const st = hotspotState(h);
              const sel = h.id === selectedHotspotId;
              return (
                <button key={h.id} type="button" onClick={() => onSelectHotspot(h.id)} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold transition ${sel ? "border-teal bg-teal/10 text-ink" : "border-ink/15 text-ink/65 hover:border-ink/30"}`}>
                  {h.name}
                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] uppercase ${st.tone}`}>{st.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mb-3 text-xs text-ink/45">{advanced ? "No hotspots yet — add one below." : "This asset has no connectable regions yet."}</p>
        )}

        {/* Binding form for the selected hotspot */}
        {selected ? (
          <div className="space-y-2.5 rounded-2xl border border-ink/10 bg-white/50 p-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink/45">Selected region</p>
              <h4 className="display text-sm leading-tight text-ink">{selected.name}</h4>
              <p className="text-[11px] text-ink/50">Opens: <span className="font-bold capitalize">{selected.semantic.replace("_", " ")}</span></p>
            </div>

            {internal ? (
              <p className="rounded-lg bg-teal/10 px-2.5 py-1.5 text-[11px] text-teal">This is a built-in action — no link needed. It runs in the Nest.</p>
            ) : (
              <label className="block">
                <span className="text-[9px] font-bold uppercase tracking-wide text-ink/45">Link</span>
                <div className="relative mt-0.5">
                  <Link2 className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
                  <input value={url} onChange={(e) => setUrl(e.target.value)} onFocus={expand} placeholder={placeholder} inputMode="url" className="w-full rounded-lg border border-ink/15 bg-white/80 py-2 pl-7 pr-2 text-sm text-ink focus:border-teal focus:outline-none" />
                </div>
              </label>
            )}
            <label className="block">
              <span className="text-[9px] font-bold uppercase tracking-wide text-ink/45">Label (optional)</span>
              <input value={label} onChange={(e) => setLabel(e.target.value)} onFocus={expand} placeholder={selected.name} className="mt-0.5 w-full rounded-lg border border-ink/15 bg-white/80 py-1.5 px-2 text-sm text-ink focus:border-teal focus:outline-none" />
            </label>

            {error ? <p className="text-[11px] font-bold text-terracotta">{error}</p> : null}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={connect} className="inline-flex items-center gap-1 rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-parchment hover:bg-ink/85">{selected.binding ? "Save" : "Connect"}</button>
              {selected.binding ? <button type="button" onClick={remove} className="inline-flex items-center gap-1 rounded-full border border-terracotta/40 px-3 py-1.5 text-xs font-bold text-terracotta hover:bg-terracotta/10">Remove</button> : null}
            </div>

            {/* Advanced authoring */}
            {advanced ? (
              <div className="mt-2 space-y-2 border-t border-ink/10 pt-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-terracotta">Advanced authoring</p>
                <label className="block">
                  <span className="text-[9px] font-bold uppercase tracking-wide text-ink/45">Name</span>
                  <input value={selected.name} onChange={(e) => patch({ name: e.target.value })} className="mt-0.5 w-full rounded-lg border border-ink/15 bg-white/70 py-1.5 px-2 text-xs text-ink focus:border-teal focus:outline-none" />
                </label>
                <label className="block">
                  <span className="text-[9px] font-bold uppercase tracking-wide text-ink/45">Semantic</span>
                  <select value={selected.semantic} onChange={(e) => patch({ semantic: e.target.value as NestHotspotSemantic })} className="mt-0.5 w-full rounded-lg border border-ink/15 bg-white/70 py-1.5 px-2 text-xs text-ink focus:border-teal focus:outline-none">
                    {NEST_HOTSPOT_SEMANTICS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => patch({ locked: !selected.locked })} aria-pressed={selected.locked} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold ${selected.locked ? "border-terracotta text-terracotta" : "border-ink/15 text-ink/60"}`}>{selected.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />} {selected.locked ? "Locked" : "Lock"}</button>
                  <button type="button" onClick={() => patch({ enabled: !selected.enabled })} aria-pressed={!selected.enabled} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold ${selected.enabled ? "border-ink/15 text-ink/60" : "border-terracotta text-terracotta"}`}>{selected.enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />} {selected.enabled ? "Enabled" : "Disabled"}</button>
                  <button type="button" onClick={() => { onCommit(removeHotspot(hotspots, selected.id)); onSelectHotspot(undefined); }} className="inline-flex items-center gap-1 rounded-md border border-terracotta/40 px-2 py-1 text-[10px] font-bold text-terracotta hover:bg-terracotta/10"><Trash2 className="h-3 w-3" /> Delete</button>
                </div>
                <p className="text-[10px] text-ink/40">Drag the region on the canvas to move it; use its corner handles to resize.</p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-ink/45">{hotspots.length ? "Tap a region above (or on the Nest) to connect it." : ""}</p>
        )}

        {/* Advanced: add new regions */}
        {advanced ? (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => addShape("rect")} className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-bold text-ink/70 hover:border-teal"><Square className="h-3.5 w-3.5" /> Add rectangle</button>
            <button type="button" onClick={() => addShape("ellipse")} className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-bold text-ink/70 hover:border-teal"><Plus className="h-3.5 w-3.5" /> Add ellipse</button>
          </div>
        ) : null}
      </div>
    </MobileBottomSheet>
  );
}
