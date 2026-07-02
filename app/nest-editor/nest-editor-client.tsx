"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, Plus, Trash2, X } from "lucide-react";
import { getAssets, resolveAsset, resolveBackground, resolveTemplate, saveDocAsTemplate } from "@/lib/nest-production-library";
import { loadDoc, nestBackend, persistDoc, publish, type PublishResult } from "@/lib/nest-repo";
import { getNestSession, localSignUp, signInWithGoogle, signUpWithEmail, type NestSession } from "@/lib/nest-auth";
import { PUBLISH_VISIBILITY_OPTIONS, type NestPublishVisibility } from "@/lib/nest-production-types";
import type { NestDocument, NestPlacement } from "@/lib/nest-document-types";

export function NestEditorClient({ docId }: { docId?: string }) {
  const [doc, setDoc] = useState<NestDocument | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [showPalette, setShowPalette] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [savedAt, setSavedAt] = useState<string>();
  const [tplMsg, setTplMsg] = useState<string>();

  useEffect(() => {
    let alive = true;
    if (!docId) { setDoc(null); setLoaded(true); return; }
    loadDoc(docId).then((d) => { if (alive) { setDoc(d ?? null); setLoaded(true); } });
    return () => { alive = false; };
  }, [docId]);

  // Persist every change (save draft): optimistic UI + async write to the backend.
  const persist = useCallback((next: NestDocument) => {
    setDoc(next);
    persistDoc(next).then((saved) => setSavedAt(saved.updatedAt)).catch(() => {});
  }, []);

  const palette = useMemo(() => getAssets({ onlyVisible: true }), []);
  const background = doc ? resolveBackground(doc.backgroundId) : undefined;

  if (loaded && (!doc || !background)) {
    return (
      <div className="mx-auto max-w-[460px] px-4 py-16 text-center">
        <h1 className="display text-2xl">No Nest to edit</h1>
        <p className="mt-2 text-sm text-ink-soft">Start by choosing a template or a room.</p>
        <Link href="/design/nest-onboarding" className="mt-4 inline-block rounded-xl bg-[#d9913c] px-4 py-2 text-sm font-bold text-white">Create your Nest</Link>
      </div>
    );
  }
  if (!doc || !background) return null;

  function mutatePlacements(fn: (p: NestPlacement[]) => NestPlacement[]) {
    persist({ ...doc!, placements: fn(doc!.placements) });
  }
  function addAsset(assetId: string) {
    const maxZ = doc!.placements.reduce((m, p) => Math.max(m, p.zIndex ?? 0), 0);
    const pl: NestPlacement = { id: `pl-${Date.now().toString(36)}`, assetId, x: 0.5, y: 0.8, scale: 0.45, zIndex: maxZ + 1 };
    mutatePlacements((ps) => [...ps, pl]);
    setSelectedId(pl.id);
    setShowPalette(false);
  }
  function deleteSelected() {
    if (!selectedId) return;
    mutatePlacements((ps) => ps.filter((p) => p.id !== selectedId));
    setSelectedId(undefined);
  }
  // Save the CURRENT document state as a draft template (shared saveDocAsTemplate).
  function saveTemplate() {
    const persona = (doc!.sourceTemplateId ? resolveTemplate(doc!.sourceTemplateId)?.persona : undefined) ?? "Creator";
    const tpl = saveDocAsTemplate({
      name: doc!.title, persona, backgroundId: doc!.backgroundId, placements: doc!.placements,
    });
    setTplMsg(`Saved “${tpl.name}” as a draft template — approve it in admin.`);
    setTimeout(() => setTplMsg(undefined), 3200);
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[460px] px-4 pb-28 pt-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow text-terracotta">Editing · {savedAt ? "saved" : "draft"}</p>
          <input
            value={doc.title}
            onChange={(e) => persist({ ...doc, title: e.target.value })}
            className="display w-full truncate bg-transparent text-2xl leading-tight outline-none"
            aria-label="Nest title"
          />
          <p className="text-xs text-ink-soft">{background.name} · {doc.placements.length} objects</p>
        </div>
        <button onClick={() => setShowPalette(true)} className="flex shrink-0 items-center gap-1 rounded-xl bg-[#4d7358] px-3 py-2 text-xs font-bold text-white">
          <Plus className="size-4" /> Add
        </button>
      </div>

      <Stage
        doc={doc}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onMove={(id, x, y) => mutatePlacements((ps) => ps.map((p) => (p.id === id ? { ...p, x, y } : p)))}
      />

      {selectedId ? (
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-[#e0d5b8] bg-[#efe7cf] px-3 py-2">
          <span className="text-sm font-bold">{resolveAsset(doc.placements.find((p) => p.id === selectedId)?.assetId ?? "")?.name ?? "Object"} selected</span>
          <button onClick={deleteSelected} className="flex items-center gap-1 rounded-lg bg-[#a94f5c] px-3 py-1.5 text-xs font-bold text-white">
            <Trash2 className="size-4" /> Delete
          </button>
        </div>
      ) : (
        <p className="mt-3 px-1 text-xs text-ink-soft">Tap an object to select it, then drag to move or delete. Tap the room to deselect.</p>
      )}

      {/* publish bar */}
      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[460px] border-t border-[#e0d5b8] bg-[#f7f0dd]/95 px-4 py-3 backdrop-blur">
        <div className="flex gap-2">
          <button onClick={saveTemplate} className="rounded-xl border border-[#c9b98a] bg-white px-3 py-3 text-sm font-bold hover:bg-[#f0e9d4]">Save as template</button>
          <button onClick={() => setShowPublish(true)} className="flex-1 rounded-xl bg-[#d9913c] px-4 py-3 text-sm font-bold text-white hover:brightness-95">Publish Nest</button>
        </div>
        <p className="mt-1 text-center text-[11px] text-ink-soft">{tplMsg ?? "Draft saved on this device · no account needed until you publish."}</p>
      </div>

      {showPalette ? (
        <Palette assets={palette} onPick={addAsset} onClose={() => setShowPalette(false)} />
      ) : null}

      {showPublish ? (
        <PublishFlow doc={doc} onClose={() => setShowPublish(false)} />
      ) : null}
    </div>
  );
}

// ── Interactive stage (render · select · move) ────────────────────────────────
function Stage({
  doc,
  selectedId,
  onSelect,
  onMove,
}: {
  doc: NestDocument;
  selectedId?: string;
  onSelect: (id?: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef<string | undefined>(undefined);
  const background = resolveBackground(doc.backgroundId);

  const toNorm = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)),
    };
  };

  return (
    <div
      ref={ref}
      className="relative aspect-[3/4] w-full touch-none select-none overflow-hidden rounded-3xl border border-[#e0d5b8] bg-[#e9e0c8] shadow-sm"
      onPointerDown={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg) onSelect(undefined); }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const { x, y } = toNorm(e.clientX, e.clientY);
        onMove(dragging.current, x, y);
      }}
      onPointerUp={() => (dragging.current = undefined)}
      onPointerLeave={() => (dragging.current = undefined)}
    >
      {background ? (
        // eslint-disable-next-line @next/next/no-img-element -- local curated art
        <img data-bg src={background.variants.standard ?? background.imageUrl} alt={background.name} className="pointer-events-none absolute inset-0 size-full object-cover" />
      ) : null}
      {doc.placements
        .slice()
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
        .map((p) => (
          <PlacedAsset
            key={p.id}
            placement={p}
            selected={p.id === selectedId}
            onPointerDown={(e) => { e.stopPropagation(); onSelect(p.id); dragging.current = p.id; }}
          />
        ))}
    </div>
  );
}

function PlacedAsset({
  placement,
  selected,
  onPointerDown,
}: {
  placement: NestPlacement;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const asset = resolveAsset(placement.assetId);
  if (!asset) return null; // resolve-by-id keeps published nests safe even if archived
  const widthPct = Math.max(8, Math.min(60, (placement.scale ?? 0.4) * 55));
  return (
    <div
      data-placement={placement.id}
      onPointerDown={onPointerDown}
      className={`absolute cursor-grab active:cursor-grabbing ${selected ? "outline outline-2 outline-offset-2 outline-[#d9913c]" : ""}`}
      style={{ left: `${placement.x * 100}%`, top: `${placement.y * 100}%`, width: `${widthPct}%`, transform: "translate(-50%, -100%)", zIndex: placement.zIndex ?? 1 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local curated art */}
      <img src={asset.variants.standard ?? asset.cutoutUrl ?? asset.imageUrl} alt={asset.name} className="pointer-events-none w-full object-contain drop-shadow-md" draggable={false} />
    </div>
  );
}

// ── Palette (add furniture) ───────────────────────────────────────────────────
function Palette({ assets, onPick, onClose }: { assets: ReturnType<typeof getAssets>; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-[420px] rounded-3xl border border-[#e0d5b8] bg-[#f7f0dd] p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="display text-xl">Add an object</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-soft hover:bg-[#ece2c6]"><X className="size-5" /></button>
        </div>
        <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto">
          {assets.map((a) => (
            <button key={a.id} onClick={() => onPick(a.id)} className="rounded-xl border border-[#e0d5b8] bg-white p-2 text-center hover:bg-[#f0e9d4]">
              <div className="aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element -- local curated art */}
                <img src={a.cutoutUrl ?? a.imageUrl} alt={a.name} className="size-full object-contain" loading="lazy" />
              </div>
              <p className="mt-1 truncate text-[10px] font-bold text-ink-soft">{a.name}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Publish flow (delayed signup → visibility → real URL) ─────────────────────
// Backend-aware: local backend claims a username (M11 stub); Supabase backend
// upgrades a guest to email/Google before publishing. Guests can draft, not publish.
function PublishFlow({ doc, onClose }: { doc: NestDocument; onClose: () => void }) {
  const backend = nestBackend();
  const [session, setSession] = useState<NestSession | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visibility, setVisibility] = useState<NestPublishVisibility>("public");
  const [result, setResult] = useState<PublishResult>();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => { getNestSession().then(setSession); }, []);
  const canPublish = !!session && !session.isGuest;

  const fullUrl = result ? (typeof window !== "undefined" ? window.location.origin + result.url : result.url) : "";

  async function refresh() { setSession(await getNestSession()); }
  function doLocalSignup() { if (!username.trim()) return; localSignUp(username); void refresh(); }
  async function doEmailSignup() {
    setError(undefined);
    try { await signUpWithEmail(email, password); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Sign-up failed."); }
  }
  async function doGoogle() {
    setError(undefined);
    try { await signInWithGoogle(); } catch (e) { setError(e instanceof Error ? e.message : "Google sign-in failed."); }
  }
  async function doPublish() {
    const r = await publish(doc.id, visibility);
    if (r) setResult(r);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(fullUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-[420px] rounded-3xl border border-[#e0d5b8] bg-[#f7f0dd] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-start justify-between">
          <h2 className="display text-2xl">{result ? "Your Nest is live" : canPublish ? "Publish your Nest" : "Create an account to publish your Nest"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-soft hover:bg-[#ece2c6]"><X className="size-5" /></button>
        </div>

        {result ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">Share this link — it opens for anyone{result.visibility === "public" || result.visibility === "unlisted" ? "" : " you allow"}:</p>
            <div className="flex items-center gap-2 rounded-xl border border-[#c9b98a] bg-white px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-xs">{fullUrl}</span>
              <button onClick={copy} className="flex items-center gap-1 rounded-lg bg-[#4d7358] px-2 py-1 text-xs font-bold text-white">
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? "Copied" : "Copy"}
              </button>
            </div>
            <a href={result.url} target="_blank" rel="noreferrer" className="block rounded-xl bg-[#d9913c] px-4 py-3 text-center text-sm font-bold text-white">Open your Nest</a>
            <p className="text-center text-[11px] text-ink-soft">Visibility: {result.visibility} · backend: {backend}</p>
          </div>
        ) : !canPublish ? (
          <div className="space-y-3">
            {backend === "local" ? (
              <>
                <p className="text-sm text-ink-soft">Your work is saved on this device. Pick a username to claim + publish it.</p>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" className="w-full rounded-xl border border-[#c9b98a] bg-white px-3 py-2.5 text-sm" />
                <button onClick={doLocalSignup} disabled={!username.trim()} className="w-full rounded-xl bg-[#d9913c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Create account</button>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-soft">Your draft is saved. Create an account to publish it and keep it on every device.</p>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" type="email" className="w-full rounded-xl border border-[#c9b98a] bg-white px-3 py-2.5 text-sm" />
                <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" className="w-full rounded-xl border border-[#c9b98a] bg-white px-3 py-2.5 text-sm" />
                <button onClick={doEmailSignup} disabled={!email || !password} className="w-full rounded-xl bg-[#d9913c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Create account &amp; continue</button>
                <button onClick={doGoogle} className="w-full rounded-xl border border-[#c9b98a] bg-white px-4 py-3 text-sm font-bold">Continue with Google</button>
                {error ? <p className="text-center text-xs font-bold text-[#a94f5c]">{error}</p> : null}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">Signed in as <strong>{session?.username}</strong>. Choose who can see it:</p>
            <div className="grid gap-2">
              {PUBLISH_VISIBILITY_OPTIONS.map((o) => (
                <button key={o.id} onClick={() => setVisibility(o.id)} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition ${visibility === o.id ? "border-[#4d7358] bg-[#e7efe3]" : "border-[#c9b98a] bg-white hover:bg-[#f0e9d4]"}`}>
                  <span><span className="font-bold">{o.label}</span><span className="block text-xs text-ink-soft">{o.hint}</span></span>
                  <span className={`size-4 rounded-full border ${visibility === o.id ? "border-[#4d7358] bg-[#4d7358]" : "border-[#c9b98a]"}`} />
                </button>
              ))}
            </div>
            <button onClick={doPublish} className="w-full rounded-xl bg-[#4d7358] px-4 py-3 text-sm font-bold text-white">Publish ({visibility})</button>
          </div>
        )}
      </div>
    </div>
  );
}
