"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Gauge, Lightbulb, RefreshCw, Save, Sparkles, Trash2, UserSearch, WandSparkles } from "lucide-react";
import { RoomCanvas } from "@/components/room/room-canvas";
import { Button } from "@/components/ui/button";
import { loadHouse, persistHouse } from "@/lib/house-store";
import { deriveDefaultHouse, getRoomById, withRoom } from "@/lib/house";
import {
  CREATOR_PRESETS,
  DESIGN_STYLES,
  type DesignResult,
  type DesignStyle,
  creatorTypeLabels,
  generateRoomDesign,
  moodLabels,
  purposeLabels,
  styleDescription,
  styleLabel,
} from "@/lib/ai-room-designer";
import { type CreatorAnalysis, type CreatorAnalyzerInput, generateCreatorRoom } from "@/lib/creator-analyzer";
import { type RoomDesignDraft, deleteDraft, getDrafts, saveDraft } from "@/lib/room-design-drafts";
import { recordActivity } from "@/lib/activity";
import { trackEvent } from "@/lib/events";
import { friendlyError } from "@/lib/errors";
import { flags } from "@/lib/flags";
import type { HouseRooms, Room, RoomKind, Shop } from "@/lib/types";
import { cn } from "@/lib/utils";

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

// A session-only history entry (the brief + its result). Not persisted — drafts
// are the persistence mechanism.
type HistoryEntry = { brief: string; result: DesignResult };

export function RoomDesigner({ shop }: { shop: Shop }) {
  const [house, setHouse] = useState<HouseRooms>(() => deriveDefaultHouse(shop));
  const [targetRoomId, setTargetRoomId] = useState<string>("");
  const [brief, setBrief] = useState("Create a cozy reading room");
  const [style, setStyle] = useState<DesignStyle>("cozy");
  const [roomType, setRoomType] = useState<RoomKind | "auto">("auto");
  const [variant, setVariant] = useState(0);
  const [result, setResult] = useState<DesignResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  // ── V3: Creator Auto Build ──
  const [igUrl, setIgUrl] = useState("");
  const [ttUrl, setTtUrl] = useState("");
  const [ytUrl, setYtUrl] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [autoBio, setAutoBio] = useState("");
  const [analysis, setAnalysis] = useState<CreatorAnalysis | null>(null);
  const [creatorInput, setCreatorInput] = useState<CreatorAnalyzerInput | null>(null);
  const [drafts, setDrafts] = useState<RoomDesignDraft[]>([]);
  const [lastApplied, setLastApplied] = useState<string>("");
  const [notice, setNotice] = useState("");

  // Load the saved (or derived) house + drafts on the client.
  useEffect(() => {
    loadHouse(shop)
      .then((loaded) => {
        setHouse(loaded);
        setTargetRoomId(loaded.entryRoomId);
      })
      .catch(() => undefined);
  }, [shop]);

  useEffect(() => {
    const sync = () => setDrafts(getDrafts(shop.address));
    sync();
    window.addEventListener("ai-bazaar-design-drafts-changed", sync);
    return () => window.removeEventListener("ai-bazaar-design-drafts-changed", sync);
  }, [shop.address]);

  const targetRoom = useMemo(() => getRoomById(house, targetRoomId) ?? house.rooms[0], [house, targetRoomId]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
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
    setAnalysis(null);
    setCreatorInput(null);
    setHistory((h) => [{ brief: brief.trim(), result: design }, ...h].slice(0, 6));
    trackEvent(regenerated ? "room_design_regenerated" : "room_design_generated", { shopId: shop.id });
    if (design.detectedConstraints.length > 0) trackEvent("room_design_constraint_detected", { shopId: shop.id });
  };

  const generate = () => runGenerate(0, false);
  const regenerate = () => {
    if (creatorInput) autoBuild(creatorInput, variant + 1, true);
    else runGenerate(variant + 1, true);
  };

  const runPreset = (presetId: string) => {
    const preset = CREATOR_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setBrief(preset.brief);
    setStyle(preset.style);
    const design = generateRoomDesign({ brief: preset.brief, address: shop.address, style: preset.style, variant: 0 });
    setResult(design);
    setVariant(0);
    setAnalysis(null);
    setCreatorInput(null);
    setHistory((h) => [{ brief: preset.brief, result: design }, ...h].slice(0, 6));
    trackEvent("room_design_preset_used", { shopId: shop.id, targetId: preset.id });
    trackEvent("room_design_generated", { shopId: shop.id });
    if (design.detectedConstraints.length > 0) trackEvent("room_design_constraint_detected", { shopId: shop.id });
  };

  // ── V3: build a room from social profiles ──
  const autoBuild = (input: CreatorAnalyzerInput, nextVariant: number, regenerated: boolean) => {
    const built = generateCreatorRoom(input, shop.address, nextVariant);
    setResult(built.result);
    setAnalysis(built.analysis);
    setCreatorInput(input);
    setVariant(nextVariant);
    setHistory((h) => [{ brief: built.analysis.summary, result: built.result }, ...h].slice(0, 6));
    trackEvent("creator_profile_analyzed", { shopId: shop.id });
    trackEvent("creator_room_generated", { shopId: shop.id });
    for (let i = 0; i < built.socialObjects; i += 1) trackEvent("creator_social_object_created", { shopId: shop.id });
    void regenerated;
  };

  const runAutoBuild = () => {
    const input: CreatorAnalyzerInput = {
      instagramUrl: igUrl.trim() || undefined,
      tiktokUrl: ttUrl.trim() || undefined,
      youtubeUrl: ytUrl.trim() || undefined,
      websiteUrl: webUrl.trim() || undefined,
      bio: autoBio.trim() || undefined,
    };
    if (!input.instagramUrl && !input.tiktokUrl && !input.youtubeUrl && !input.websiteUrl && !input.bio) {
      flash("Add at least one profile link or a bio.");
      return;
    }
    autoBuild(input, 0, false);
  };

  // Replace the active room's content with `room`, keeping its identity.
  const applyRoom = (room: Room, label: string) => {
    if (!targetRoom) return;
    const merged = { ...targetRoom, name: room.name, type: room.type, background: room.background, description: room.description ?? "", objects: room.objects };
    const nextHouse = withRoom(house, merged);
    void persistHouse(nextHouse).catch((err) => flash(friendlyError(err, "save")));
    setHouse(nextHouse);
    setLastApplied(merged.name);
    if (flags.activityFeed) {
      recordActivity({ type: "updated_house", actorName: shop.owner, actorHandle: shop.ownerHandle, summary: `redesigned ${merged.name}`, href: `/shop/${shop.address}` });
    }
    flash(`Applied ${label} to ${merged.name}.`);
  };

  const apply = () => {
    if (!result) return;
    applyRoom(result.room, creatorInput ? "your creator room" : "the design");
    trackEvent(creatorInput ? "creator_room_applied" : "room_design_applied", { shopId: shop.id });
    setResult(null);
  };

  const saveAsDraft = () => {
    if (!result) return;
    saveDraft({
      shopAddress: shop.address,
      name: result.room.name,
      brief: creatorInput ? (analysis?.summary ?? "Creator room") : brief,
      style: result.style,
      intentId: result.intentId,
      parsed: result.parsed,
      room: result.room,
    });
    trackEvent("room_design_draft_saved", { shopId: shop.id });
    flash("Saved as draft.");
  };

  const applyDraft = (draft: RoomDesignDraft) => {
    applyRoom(draft.room, "draft");
    trackEvent("room_design_draft_applied", { shopId: shop.id, targetId: draft.id });
  };

  const removeDraft = (draft: RoomDesignDraft) => {
    deleteDraft(shop.address, draft.id);
    flash("Draft deleted.");
  };

  const parsed = result?.parsed;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
      {/* ── Left: brief, presets, style, targeting, drafts ── */}
      <aside className="space-y-4 xl:sticky xl:top-20">
        <div className="grain overflow-hidden rounded-[2rem] bg-gradient-to-br from-ink to-[#4b2d29] p-5 text-white shadow-lift">
          <div className="flex items-center gap-2 text-saffron">
            <WandSparkles size={17} />
            <span className="text-xs font-black uppercase tracking-[.15em]">AI room designer</span>
          </div>
          <p className="mt-2 text-xs text-white/55">
            Describe the room you want — creator type, mood, purpose, and constraints
            (“no plants”, “only 4 objects”, “show booking”) are understood. Selects and
            arranges existing assets; never generates images.
          </p>

          <label className="mt-4 block text-[11px] font-black uppercase tracking-wider text-white/45">
            Your brief
            <textarea
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              rows={3}
              placeholder="A dark minimalist developer room with no plants"
              className="mt-1.5 w-full resize-none rounded-2xl border border-white/10 bg-white/10 p-3 text-sm font-normal normal-case tracking-normal text-white outline-none placeholder:text-white/35 focus:border-saffron"
            />
          </label>

          <Button onClick={generate} variant="accent" className="mt-3 w-full" disabled={!brief.trim()}>
            <Sparkles size={15} /> Generate design
          </Button>
        </div>

        {/* Creator Auto Build (V3) */}
        <div className="card rounded-[2rem] p-5">
          <p className="eyebrow text-teal"><UserSearch size={13} className="-mt-0.5 mr-1 inline" /> Creator auto build</p>
          <p className="mt-1 text-xs text-ink/45">
            Paste your profiles — we read the links + bio (no scraping, no APIs) and build a room with your socials and an about-me.
          </p>
          <div className="mt-3 space-y-2">
            <input value={igUrl} onChange={(e) => setIgUrl(e.target.value)} aria-label="Instagram URL" placeholder="instagram.com/yourhandle" className="min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm text-ink" />
            <input value={ttUrl} onChange={(e) => setTtUrl(e.target.value)} aria-label="TikTok URL" placeholder="tiktok.com/@yourhandle" className="min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm text-ink" />
            <input value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} aria-label="YouTube URL" placeholder="youtube.com/@yourchannel" className="min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm text-ink" />
            <input value={webUrl} onChange={(e) => setWebUrl(e.target.value)} aria-label="Website URL" placeholder="your-studio.com" className="min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm text-ink" />
            <textarea value={autoBio} onChange={(e) => setAutoBio(e.target.value)} rows={2} aria-label="Bio" placeholder="Optional bio — e.g. “Wedding photographer taking bookings”" className="w-full resize-none rounded-xl border border-ink/10 bg-white p-3 text-sm text-ink" />
          </div>
          <Button onClick={runAutoBuild} variant="accent" className="mt-3 w-full"><UserSearch size={15} /> Auto-build room</Button>
        </div>

        {/* Creator presets */}
        <div className="card rounded-[2rem] p-5">
          <p className="eyebrow text-teal">Creator presets</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {CREATOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => runPreset(preset.id)}
                title={preset.brief}
                className="rounded-2xl border border-ink/10 bg-white px-2.5 py-2 text-left text-[11px] font-bold text-ink/65 shadow-sm transition hover:-translate-y-0.5 hover:border-terracotta hover:text-terracotta"
              >
                {preset.label}
              </button>
            ))}
          </div>
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
                  style === option ? "border-terracotta bg-terracotta text-white" : "border-ink/10 bg-white text-ink/60 hover:border-terracotta",
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
            <select value={roomType} onChange={(e) => setRoomType(e.target.value as RoomKind | "auto")} className="mt-1.5 min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink">
              {ROOM_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          {house.rooms.length > 1 && (
            <label className="block text-xs font-black uppercase tracking-wider text-ink/45">
              Apply to
              <select value={targetRoomId} onChange={(e) => setTargetRoomId(e.target.value)} className="mt-1.5 min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink">
                {house.rooms.map((room) => <option key={room.id} value={room.id}>{room.name}{room.id === house.entryRoomId ? " (entry)" : ""}</option>)}
              </select>
            </label>
          )}
          <p className="text-[11px] text-ink/40">Applying replaces the contents of <span className="font-bold text-ink/60">{targetRoom?.name}</span>. Nothing changes until you press Apply.</p>
          {lastApplied && <p className="text-[11px] font-bold text-emerald-700">Last applied: {lastApplied}</p>}
        </div>

        {/* Saved drafts */}
        <div className="card rounded-[2rem] p-5">
          <p className="eyebrow text-teal"><Save size={13} className="-mt-0.5 mr-1 inline" /> Saved drafts</p>
          {drafts.length === 0 ? (
            <p className="mt-2 text-xs text-ink/45">No drafts yet. Generate a design and press “Save draft” to keep it for later.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {drafts.map((draft) => (
                <li key={draft.id} className="flex items-center gap-1 rounded-xl border border-ink/10 bg-white px-2.5 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink/70">{draft.name}</span>
                    <span className="block truncate text-[10px] text-ink/40">{styleLabel(draft.style)} · {draft.room.objects.length} objects</span>
                  </span>
                  <button onClick={() => applyDraft(draft)} className="rounded-lg bg-terracotta/10 px-2 py-1 text-[11px] font-bold text-terracotta hover:bg-terracotta/20">Apply</button>
                  <button onClick={() => removeDraft(draft)} aria-label="Delete draft" className="grid size-7 place-items-center rounded-lg text-ink/40 hover:text-terracotta"><Trash2 size={13} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {notice && <p className="text-center text-xs font-bold text-teal">{notice}</p>}
      </aside>

      {/* ── Right: preview (current vs proposed) + explanations + history ── */}
      <div className="min-w-0">
        {result ? (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow text-terracotta">Proposed design</p>
                <p className="text-sm font-bold text-ink/60">{result.intentLabel} · {styleLabel(result.style)} style · {result.picks.length} objects</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={saveAsDraft} className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-bold text-ink/60 hover:border-terracotta hover:text-terracotta"><Save size={15} /> Save draft</button>
                <button onClick={regenerate} className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-bold text-ink/60 hover:border-terracotta hover:text-terracotta"><RefreshCw size={15} /> Regenerate</button>
                <button onClick={apply} className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#9a4a30]"><Check size={15} /> Apply</button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-wider text-ink/40">Current · {targetRoom?.name}</p>
                <div className="relative h-[40vh] min-h-[300px] overflow-hidden rounded-[2rem] border-[8px] border-white/65">
                  {targetRoom && <RoomCanvas room={targetRoom} mode="public" ownerName={shop.owner} />}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-wider text-terracotta">Proposed · {result.room.name}</p>
                <div className="relative h-[40vh] min-h-[300px] overflow-hidden rounded-[2rem] border-[8px] border-terracotta/30">
                  <RoomCanvas room={result.room} mode="public" ownerName={shop.owner} />
                </div>
              </div>
            </div>

            {/* Analyzer insights (V3 — creator auto build) */}
            {analysis && (
              <div className="card mt-4 rounded-[2rem] p-5">
                <div className="flex items-center justify-between">
                  <p className="eyebrow text-teal"><UserSearch size={13} className="-mt-0.5 mr-1 inline" /> Analyzer insights</p>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/10 px-2.5 py-1 text-[11px] font-bold text-teal"><Gauge size={12} /> {Math.round(analysis.confidence * 100)}% confidence</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Chip label="Creator" value={creatorTypeLabels[analysis.creatorType]} />
                  <Chip label="Purpose" value={purposeLabels[analysis.purpose]} />
                  <Chip label="Mood" value={moodLabels[analysis.mood]} />
                </div>
                {analysis.socialLinks.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-ink/40">Social links</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {analysis.socialLinks.map((l) => (
                        <span key={l.platform} className="rounded-full bg-ink/5 px-2.5 py-1 text-[11px] font-bold text-ink/60">{l.label}{l.username ? ` · @${l.username}` : ""}</span>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.keywords.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-ink/40">Keywords found</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {analysis.keywords.map((k) => (
                        <span key={k} className="rounded-full bg-saffron/15 px-2.5 py-1 text-[11px] font-bold text-amber-700">{k}</span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="mt-3 text-sm text-ink/60">{analysis.summary}</p>
              </div>
            )}

            {/* Detected dimensions */}
            <div className="card mt-4 rounded-[2rem] p-5">
              <p className="eyebrow text-teal"><Lightbulb size={13} className="-mt-0.5 mr-1 inline" /> What I understood</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip label="Creator" value={parsed?.creatorType ? creatorTypeLabels[parsed.creatorType] : "—"} />
                <Chip label="Mood" value={parsed?.mood ? moodLabels[parsed.mood] : "—"} />
                <Chip label="Purpose" value={parsed?.purpose ? purposeLabels[parsed.purpose] : "—"} />
                <Chip label="Theme" value={result.intentLabel} />
              </div>
              {result.detectedConstraints.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-ink/40">Constraints applied</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {result.detectedConstraints.map((c) => (
                      <span key={c} className="rounded-full bg-terracotta/10 px-2.5 py-1 text-[11px] font-bold text-terracotta">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              <p className="mt-4 text-[10px] font-black uppercase tracking-wider text-ink/40">Why this layout</p>
              <ul className="mt-2 space-y-1.5">
                {result.explanations.map((line, index) => (
                  <li key={index} className="flex gap-2 text-sm text-ink/65">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-terracotta/60" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recent designs (session history) */}
            {history.length > 1 && (
              <div className="card mt-4 rounded-[2rem] p-5">
                <p className="eyebrow text-teal"><Clock size={13} className="-mt-0.5 mr-1 inline" /> Recent designs</p>
                <ul className="mt-3 space-y-1.5">
                  {history.map((entry, index) => (
                    <li key={index}>
                      <button onClick={() => setResult(entry.result)} className="flex w-full items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2 text-left hover:border-terracotta">
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink/70">{entry.brief}</span>
                        <span className="shrink-0 text-[10px] text-ink/40">{styleLabel(entry.result.style)} · {entry.result.picks.length}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="grid h-[60vh] min-h-[460px] place-items-center rounded-[2.75rem] border-[10px] border-dashed border-white/65 bg-white/40 p-8 text-center">
            <div className="max-w-sm">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-rosewater text-terracotta"><WandSparkles size={26} /></span>
              <h2 className="display mt-4 text-3xl">Describe your dream room.</h2>
              <p className="mt-2 text-sm text-ink/55">Type a brief or pick a creator preset, then Generate. You’ll see a proposed layout next to your current room before anything changes.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-2.5 py-1 text-[11px] font-bold text-ink/60">
      <span className="text-ink/35">{label}:</span> {value}
    </span>
  );
}
