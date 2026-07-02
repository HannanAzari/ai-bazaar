"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addCustomTemplate,
  getLibrary,
  onProductionChanged,
  resetCuration,
  setItemStatus,
} from "@/lib/nest-production-library";
import type {
  ProductionAsset,
  ProductionBackground,
  ProductionLibrary,
  ProductionLibraryStatus,
  ProductionTemplate,
} from "@/lib/nest-production-types";

const ADMIN_FLAG = "nestudio-admin-mode";
const STATUS_ACTIONS: ProductionLibraryStatus[] = ["approved", "featured", "hidden", "archived"];
const STATUS_STYLE: Record<ProductionLibraryStatus, string> = {
  draft: "bg-[#dcd0ad] text-ink-soft",
  approved: "bg-[#4d7358] text-white",
  featured: "bg-[#d9913c] text-white",
  hidden: "bg-[#8a8172] text-white",
  archived: "bg-[#a94f5c] text-white",
};

// Starter placements for "Create Template From Current Nest" (fixture/current doc stand-in).
const STARTER_PLACEMENTS = [
  { assetId: "ast-lr-sofa-boucle", slotType: "seat" as const, x: 0.38, y: 0.85, scale: 0.62, zIndex: 3 },
  { assetId: "ast-lr-table-oak-round", slotType: "table" as const, x: 0.56, y: 0.92, scale: 0.3, zIndex: 4 },
  { assetId: "ast-lr-media-oak-console", slotType: "media" as const, x: 0.5, y: 0.52, scale: 0.78, zIndex: 2 },
];

export function NestAdminClient() {
  const [adminMode, setAdminMode] = useState(false);
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<"backgrounds" | "assets" | "templates">("backgrounds");

  useEffect(() => {
    setAdminMode(typeof window !== "undefined" && localStorage.getItem(ADMIN_FLAG) === "on");
    setReady(true);
    return onProductionChanged(() => setTick((t) => t + 1));
  }, []);

  const lib: ProductionLibrary = useMemo(() => { void tick; return getLibrary(); }, [tick]);

  function toggleAdmin(on: boolean) {
    localStorage.setItem(ADMIN_FLAG, on ? "on" : "off");
    setAdminMode(on);
  }

  if (!ready) return null;

  if (!adminMode) {
    return (
      <section className="shell space-y-4 py-16 text-center">
        <p className="eyebrow text-terracotta">Nest admin · internal</p>
        <h1 className="display text-3xl">Admin mode is off</h1>
        <p className="mx-auto max-w-md text-sm text-ink-soft">Curation tools are gated behind a local admin-mode flag (no real auth in this sprint).</p>
        <button onClick={() => toggleAdmin(true)} className="mx-auto rounded-xl bg-[#4d7358] px-5 py-2.5 text-sm font-bold text-white">Enable admin mode</button>
      </section>
    );
  }

  return (
    <section className="shell space-y-6 py-8">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <p className="eyebrow text-terracotta">Nest admin · curation</p>
          <h1 className="display text-3xl">Production library</h1>
        </div>
        <span className="ml-auto flex gap-2">
          <button onClick={() => { if (confirm("Reset all admin decisions to fixture defaults?")) resetCuration(); }} className="rounded-lg border border-[#c9b98a] bg-white px-3 py-1.5 text-xs font-bold hover:bg-[#f0e9d4]">Reset curation</button>
          <button onClick={() => toggleAdmin(false)} className="rounded-lg border border-[#c9b98a] bg-white px-3 py-1.5 text-xs font-bold hover:bg-[#f0e9d4]">Exit admin</button>
        </span>
      </header>

      <p className="max-w-2xl text-sm text-ink-soft">
        Curation, not file management. Items are never deleted — only moved between statuses. Only
        <strong> approved</strong> / <strong>featured</strong> items reach onboarding; draft / hidden / archived do not.
        Old Nests keep resolving hidden/archived assets by id.
      </p>

      <div className="flex gap-2">
        {(["backgrounds", "assets", "templates"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-xl px-4 py-2 text-sm font-bold capitalize ${tab === t ? "bg-[#38291d] text-white" : "border border-[#c9b98a] bg-white text-ink hover:bg-[#f0e9d4]"}`}>
            {t} ({lib[t].length})
          </button>
        ))}
      </div>

      {tab === "templates" ? <CreateTemplate backgrounds={lib.backgrounds.map((b) => ({ id: b.id, name: b.name }))} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {(tab === "backgrounds" ? lib.backgrounds : tab === "assets" ? lib.assets : lib.templates).map(
          (item: ProductionBackground | ProductionAsset | ProductionTemplate) => (
            <ItemRow
              key={item.id}
              id={item.id}
              name={item.name}
              sub={
                tab === "backgrounds"
                  ? (item as ProductionBackground).style
                  : tab === "assets"
                    ? (item as ProductionAsset).category
                    : (item as ProductionTemplate).persona
              }
              image={imageFor(tab, item)}
              status={item.status}
            />
          ),
        )}
      </div>
    </section>
  );
}

function imageFor(tab: string, item: unknown): string | undefined {
  const it = item as { imageUrl?: string; previewImage?: string; cutoutUrl?: string; variants?: { standard?: string } };
  if (tab === "assets") return it.cutoutUrl ?? it.variants?.standard ?? it.imageUrl;
  return it.previewImage ?? it.variants?.standard ?? it.imageUrl;
}

function ItemRow({ id, name, sub, image, status }: { id: string; name: string; sub?: string; image?: string; status: ProductionLibraryStatus }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-[#e0d5b8] bg-[#efe7cf] p-3">
      <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-[#e9e0c8]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- local curated art
          <img src={image} alt={name} className="size-full object-cover" loading="lazy" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold">{name}</p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_STYLE[status]}`}>{status}</span>
        </div>
        {sub ? <p className="truncate text-xs text-ink-soft">{sub}</p> : null}
        <p className="truncate text-[10px] text-ink-soft">{id}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {STATUS_ACTIONS.map((s) => (
            <button
              key={s}
              disabled={status === s}
              onClick={() => setItemStatus(id, s)}
              className={`rounded-lg border px-2 py-1 text-[11px] font-bold capitalize ${status === s ? `${STATUS_STYLE[s]} border-transparent` : "border-[#c9b98a] bg-white text-ink hover:bg-[#f0e9d4]"}`}
            >
              {s === "approved" ? "Approve" : s === "featured" ? "Feature" : s === "hidden" ? "Hide" : "Archive"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CreateTemplate({ backgrounds }: { backgrounds: { id: string; name: string }[] }) {
  const [name, setName] = useState("");
  const [persona, setPersona] = useState("");
  const [bg, setBg] = useState(backgrounds[0]?.id ?? "");
  const [tags, setTags] = useState("");
  const [saved, setSaved] = useState<string>();

  function save() {
    if (!name || !bg) return;
    const tpl = addCustomTemplate({
      name, persona: persona || "Creator", backgroundId: bg,
      objectPlacements: STARTER_PLACEMENTS,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      previewImage: undefined,
    });
    setSaved(tpl.id); setName(""); setPersona(""); setTags("");
    setTimeout(() => setSaved(undefined), 2500);
  }

  return (
    <div className="rounded-2xl border border-dashed border-[#c9b98a] bg-white/60 p-4">
      <p className="text-sm font-bold">Create Template From Current Nest</p>
      <p className="mb-3 text-xs text-ink-soft">Saves a <strong>draft</strong> template locally from the current document (starter placements for now). Approve it above to publish.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" className="rounded-lg border border-[#c9b98a] bg-white px-3 py-2 text-sm" />
        <input value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="Persona (e.g. Creator)" className="rounded-lg border border-[#c9b98a] bg-white px-3 py-2 text-sm" />
        <select value={bg} onChange={(e) => setBg(e.target.value)} className="rounded-lg border border-[#c9b98a] bg-white px-3 py-2 text-sm">
          {backgrounds.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags, comma, separated" className="rounded-lg border border-[#c9b98a] bg-white px-3 py-2 text-sm" />
      </div>
      <button onClick={save} disabled={!name || !bg} className="mt-3 rounded-xl bg-[#4d7358] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save draft template</button>
      {saved ? <span className="ml-2 text-xs font-bold text-[#4d7358]">Saved {saved} (draft)</span> : null}
    </div>
  );
}
