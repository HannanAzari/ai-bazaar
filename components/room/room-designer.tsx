"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Lightbulb, RefreshCw, Sparkles, WandSparkles } from "lucide-react";
import { RoomCanvas } from "@/components/room/room-canvas";
import { Button } from "@/components/ui/button";
import { getHouse, saveHouse } from "@/lib/room";
import { deriveDefaultHouse, getRoomById, withRoom } from "@/lib/house";
import {
  DESIGN_STYLES,
  type DesignResult,
  type DesignStyle,
  generateRoomDesign,
  styleDescription,
  styleLabel,
} from "@/lib/ai-room-designer";
import { recordActivity } from "@/lib/activity";
import { trackEvent } from "@/lib/events";
import { flags } from "@/lib/flags";
import type { HouseRooms, RoomKind, Shop } from "@/lib/types";
import { cn } from "@/lib/utils";

// Optional room-type override; "auto" lets the brief decide.
const ROOM_TYPE_OPTIONS: { value: RoomKind | "auto"; label: string }[] = [
  { value: "auto", label: "Auto (from brief)" },
  { value: "lounge", label: "Lounge" },
  { value: "gallery", label: "Gallery" },
  { value: "studio", label: "Studio" },
  { value: "shop", label: "Shop" },
  { value: "office", label: "Office" },
  { value: "garden", label: "Garden" },
  { value: "standard", label: "Standard" },
];

const EXAMPLE_BRIEFS = [
  "Create a cozy reading room",
  "Create a photography studio",
  "Create a gaming room",
  "Create a minimalist office",
];

export function RoomDesigner({ shop }: { shop: Shop }) {
  const [house, setHouse] = useState<HouseRooms>(() => deriveDefaultHouse(shop));
  const [targetRoomId, setTargetRoomId] = useState<string>("");
  const [brief, setBrief] = useState("Create a cozy reading room");
  const [style, setStyle] = useState<DesignStyle>("cozy");
  const [roomType, setRoomType] = useState<RoomKind | "auto">("auto");
  const [variant, setVariant] = useState(0);
  const [result, setResult] = useState<DesignResult | null>(null);
  const [notice, setNotice] = useState("");

  // Load the saved (or derived) house on the client.
  useEffect(() => {
    const loaded = getHouse(shop);
    setHouse(loaded);
    setTargetRoomId(loaded.entryRoomId);
  }, [shop]);

  const targetRoom = useMemo(
    () => getRoomById(house, targetRoomId) ?? house.rooms[0],
    [house, targetRoomId],
  );

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  };

  const runGenerate = (nextVariant: number, regenerated: boolean) => {
    if (!brief.trim()) {
      flash("Describe your room first.");
      return;
    }
    const design = generateRoomDesign({
      brief: brief.trim(),
      address: shop.address,
      style,
      roomType: roomType === "auto" ? undefined : roomType,
      variant: nextVariant,
    });
    setResult(design);
    setVariant(nextVariant);
    trackEvent(regenerated ? "room_design_regenerated" : "room_design_generated", { shopId: shop.id });
  };

  const generate = () => runGenerate(0, false);
  const regenerate = () => runGenerate(variant + 1, true);

  const apply = () => {
    if (!result || !targetRoom) return;
    // Replace the active room's content with the proposal, keeping its identity.
    const merged = {
      ...targetRoom,
      name: result.room.name,
      type: result.room.type,
      background: result.room.background,
      objects: result.room.objects,
    };
    const nextHouse = withRoom(house, merged);
    saveHouse(nextHouse);
    setHouse(nextHouse);
    trackEvent("room_design_applied", { shopId: shop.id });
    if (flags.activityFeed) {
      recordActivity({
        type: "updated_house",
        actorName: shop.owner,
        actorHandle: shop.ownerHandle,
        summary: `redesigned ${result.room.name}`,
        href: `/shop/${shop.address}`,
      });
    }
    setResult(null);
    flash(`Applied the design to ${merged.name}.`);
  };

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
      {/* ── Left: design brief ── */}
      <aside className="space-y-4 xl:sticky xl:top-20">
        <div className="grain overflow-hidden rounded-[2rem] bg-gradient-to-br from-ink to-[#4b2d29] p-5 text-white shadow-lift">
          <div className="flex items-center gap-2 text-saffron">
            <WandSparkles size={17} />
            <span className="text-xs font-black uppercase tracking-[.15em]">AI room designer</span>
          </div>
          <p className="mt-2 text-xs text-white/55">
            Describe the room you want. The designer selects and arranges existing
            catalog assets — it never generates images.
          </p>

          <label className="mt-4 block text-[11px] font-black uppercase tracking-wider text-white/45">
            Your brief
            <textarea
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              rows={3}
              placeholder="Create a cozy reading room"
              className="mt-1.5 w-full resize-none rounded-2xl border border-white/10 bg-white/10 p-3 text-sm font-normal normal-case tracking-normal text-white outline-none placeholder:text-white/35 focus:border-saffron"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXAMPLE_BRIEFS.map((example) => (
              <button
                key={example}
                onClick={() => setBrief(example)}
                className="rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-bold text-white/55 hover:border-saffron hover:text-saffron"
              >
                {example.replace("Create a ", "")}
              </button>
            ))}
          </div>

          <Button onClick={generate} variant="accent" className="mt-4 w-full" disabled={!brief.trim()}>
            <Sparkles size={15} /> Generate design
          </Button>
        </div>

        {/* Style presets */}
        <div className="card rounded-[2rem] p-5">
          <p className="eyebrow text-teal">Style</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {DESIGN_STYLES.map((option) => (
              <button
                key={option}
                onClick={() => setStyle(option)}
                title={styleDescription(option)}
                className={cn(
                  "rounded-2xl border px-3 py-2.5 text-left text-xs font-bold shadow-sm transition",
                  style === option
                    ? "border-terracotta bg-terracotta text-white"
                    : "border-ink/10 bg-white text-ink/60 hover:border-terracotta",
                )}
              >
                {styleLabel(option)}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink/45">{styleDescription(style)}</p>
        </div>

        {/* Targeting */}
        <div className="card space-y-3 rounded-[2rem] p-5">
          <label className="block text-xs font-black uppercase tracking-wider text-ink/45">
            Room type
            <select
              value={roomType}
              onChange={(event) => setRoomType(event.target.value as RoomKind | "auto")}
              className="mt-1.5 min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink"
            >
              {ROOM_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {house.rooms.length > 1 && (
            <label className="block text-xs font-black uppercase tracking-wider text-ink/45">
              Apply to
              <select
                value={targetRoomId}
                onChange={(event) => setTargetRoomId(event.target.value)}
                className="mt-1.5 min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink"
              >
                {house.rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}{room.id === house.entryRoomId ? " (entry)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="text-[11px] text-ink/40">
            Applying replaces the contents of <span className="font-bold text-ink/60">{targetRoom?.name}</span>. Nothing changes until you press Apply.
          </p>
        </div>

        {notice && <p className="text-center text-xs font-bold text-teal">{notice}</p>}
      </aside>

      {/* ── Right: preview (current vs proposed) ── */}
      <div className="min-w-0">
        {result ? (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow text-terracotta">Proposed design</p>
                <p className="text-sm font-bold text-ink/60">
                  {result.intentLabel} · {styleLabel(result.style)} style · {result.picks.length} objects
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={regenerate} className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-bold text-ink/60 hover:border-terracotta hover:text-terracotta">
                  <RefreshCw size={15} /> Regenerate
                </button>
                <button onClick={apply} className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#9a4a30]">
                  <Check size={15} /> Apply
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-wider text-ink/40">Current · {targetRoom?.name}</p>
                <div className="relative h-[42vh] min-h-[320px] overflow-hidden rounded-[2rem] border-[8px] border-white/65">
                  {targetRoom && <RoomCanvas room={targetRoom} mode="public" ownerName={shop.owner} />}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-wider text-terracotta">Proposed · {result.room.name}</p>
                <div className="relative h-[42vh] min-h-[320px] overflow-hidden rounded-[2rem] border-[8px] border-terracotta/30">
                  <RoomCanvas room={result.room} mode="public" ownerName={shop.owner} />
                </div>
              </div>
            </div>

            {/* Why this layout */}
            <div className="card mt-4 rounded-[2rem] p-5">
              <p className="eyebrow text-teal"><Lightbulb size={13} className="-mt-0.5 mr-1 inline" /> Why this layout</p>
              <ul className="mt-3 space-y-1.5">
                {result.explanations.map((line, index) => (
                  <li key={index} className="flex gap-2 text-sm text-ink/65">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-terracotta/60" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <div className="grid h-[60vh] min-h-[460px] place-items-center rounded-[2.75rem] border-[10px] border-dashed border-white/65 bg-white/40 p-8 text-center">
            <div className="max-w-sm">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-rosewater text-terracotta"><WandSparkles size={26} /></span>
              <h2 className="display mt-4 text-3xl">Describe your dream room.</h2>
              <p className="mt-2 text-sm text-ink/55">
                Type a brief like “a cozy reading room” and press Generate. You’ll see
                a proposed layout next to your current room before anything changes.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
