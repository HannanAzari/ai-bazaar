"use client";

import { useEffect, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { loadDoc, persistDoc, publish, type PublishResult } from "@/lib/nest-repo";
import { setDocOwner } from "@/lib/nest-document-store";
import { clearDraft } from "@/lib/nest-editor-storage";
import { editableObjectsToPlacements } from "@/lib/nest-editor-bridge";
import { PUBLISH_VISIBILITY_OPTIONS, type NestPublishVisibility } from "@/lib/nest-production-types";
import type { EditableNestObject } from "@/lib/nest-editor-types";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { AuthPanel } from "@/components/nest/app-shell/auth-panel";
import { z } from "@/lib/nest-layers";

// M16 publish flow on the real account: delayed sign-up preserved (guests draft;
// publishing prompts a real account) → claim a username → choose visibility → publish.
// Ownership is stamped to the account; success returns to Profile.
export function PublishGate({
  documentId,
  objects,
  onClose,
}: {
  documentId?: string;
  objects: EditableNestObject[];
  onClose: () => void;
}) {
  const { account, profile, loading, signedIn, ownerId, claimUsername } = useNestIdentity();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<NestPublishVisibility>("public");
  const [result, setResult] = useState<PublishResult>();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const hasUsername = !!profile?.username;
  const fullUrl = result ? (typeof window !== "undefined" ? window.location.origin + result.url : result.url) : "";

  // Seed the name field from the current draft title (a template/default) so the
  // creator can personalise it — identity over generic template names (Phase 8).
  useEffect(() => {
    if (!documentId) return;
    let alive = true;
    loadDoc(documentId).then((doc) => { if (alive && doc) setName(doc.title); });
    return () => { alive = false; };
  }, [documentId]);

  async function doPublish() {
    if (!documentId) { setError("No document to publish."); return; }
    if (!ownerId) { setError("Sign in to publish."); return; }
    setBusy(true);
    setError(undefined);
    try {
      // M23B §4 — publishing persists the COMPLETE current composition first, so the
      // published version is exactly what the creator was looking at. `publish()` then
      // either returns a real payload-free `/nest/<slug>` or throws; it no longer
      // degrades to a `?c=` link that only the recipient of that exact URL can open.
      const doc = await loadDoc(documentId);
      const title = name.trim() || doc?.title || "My Nest";
      if (doc) await persistDoc({ ...doc, ownerId, title, placements: editableObjectsToPlacements(objects) });
      setDocOwner(documentId, ownerId);
      const r = await publish(documentId, visibility, ownerId);
      // The canonical published version now IS the truth — drop the local autosave so the
      // editor cannot reopen an older in-progress copy over the top of it (§4).
      clearDraft(documentId);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(fullUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  const heading = result ? "Your Nest is live" : !signedIn ? "Create an account to publish" : !hasUsername ? "Claim your username" : "Publish your Nest";

  return (
    <div className={`fixed inset-0 ${z.modal} flex items-end justify-center bg-black/50 p-3 sm:items-center`} onClick={onClose}>
      <style>{`@keyframes publish-pop { 0% { transform: scale(0.4); opacity: 0 } 60% { transform: scale(1.12) } 100% { transform: scale(1); opacity: 1 } } .publish-pop { animation: publish-pop .42s cubic-bezier(.22,.61,.36,1) both } @media (prefers-reduced-motion: reduce) { .publish-pop { animation: none } }`}</style>
      <div className="w-full max-w-[420px] rounded-3xl border border-[#e0d5b8] bg-[#f7f0dd] p-5 text-ink shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-start justify-between">
          <h2 className="display text-2xl">{heading}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-soft hover:bg-[#ece2c6]"><X className="size-5" /></button>
        </div>

        {result ? (
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-1 py-1 text-center">
              <span className="publish-pop flex size-12 items-center justify-center rounded-full bg-[#4d7358] text-white shadow-md"><Check className="size-6" /></span>
              <p className="text-sm font-bold text-ink">Your Nest is live 🎉</p>
              <p className="text-xs text-ink-soft">Share the link — it opens on any device.</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-[#c9b98a] bg-white px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-xs">{fullUrl}</span>
              <button onClick={copy} aria-label="Copy link" className="flex items-center gap-1 rounded-lg bg-[#4d7358] px-2.5 py-1.5 text-xs font-bold text-white transition hover:brightness-110">
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? "Copied!" : "Copy"}
              </button>
            </div>
            {/* Enter visitor mode in the SAME tab — no new browser windows (Phase 5). */}
            <button onClick={() => { window.location.href = result.url; }} className="block w-full rounded-xl bg-[#d9913c] px-4 py-3 text-center text-sm font-bold text-white transition hover:brightness-95">Open my Nest →</button>
            <button onClick={() => { window.location.href = "/profile"; }} className="block w-full rounded-xl border border-[#c9b98a] bg-white px-4 py-3 text-center text-sm font-bold text-ink transition hover:bg-[#f0e9d4]">Back to Profile</button>
            <p className="text-center text-[11px] text-ink-soft">Visibility: {result.visibility}</p>
          </div>
        ) : loading ? (
          <p className="py-6 text-center text-sm text-ink-soft">Loading…</p>
        ) : !signedIn ? (
          <AuthPanel intro="Your work is saved on this device. Create an account to publish it and own it across devices." />
        ) : !hasUsername ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">Signed in as <strong>{account?.email}</strong>. Pick a permanent username.</p>
            <div className="flex items-center rounded-xl border border-[#c9b98a] bg-white px-3">
              <span className="text-sm font-bold text-ink/40">@</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" aria-label="Username" style={{ fontSize: 16 }} className="w-full bg-transparent py-2.5 outline-none" />
            </div>
            <button onClick={() => { const r = claimUsername(username); setError(r.ok ? undefined : r.error); }} disabled={!username.trim()} className="w-full rounded-xl bg-[#d9913c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Claim @{username || "username"}</button>
            {error ? <p className="text-center text-xs font-bold text-[#a94f5c]">{error}</p> : null}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">Publishing as <strong>@{profile?.username}</strong>.</p>
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase tracking-wider text-ink/45">Name your Nest</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Coffee & Code · Minimal Escape · The Reading Corner" aria-label="Nest name" style={{ fontSize: 16 }} className="w-full rounded-xl border border-[#c9b98a] bg-white px-3 py-2.5" />
            </label>
            <p className="text-xs font-bold text-ink/50">Who can see it?</p>
            <div className="grid gap-2">
              {PUBLISH_VISIBILITY_OPTIONS.map((o) => (
                <button key={o.id} onClick={() => setVisibility(o.id)} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition ${visibility === o.id ? "border-[#4d7358] bg-[#e7efe3]" : "border-[#c9b98a] bg-white hover:bg-[#f0e9d4]"}`}>
                  <span><span className="font-bold">{o.label}</span><span className="block text-xs text-ink-soft">{o.hint}</span></span>
                  <span className={`size-4 rounded-full border ${visibility === o.id ? "border-[#4d7358] bg-[#4d7358]" : "border-[#c9b98a]"}`} />
                </button>
              ))}
            </div>
            <button onClick={doPublish} disabled={busy} className="w-full rounded-xl bg-[#4d7358] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{busy ? "Publishing…" : `Publish (${visibility})`}</button>
            {error ? <p className="text-center text-xs font-bold text-[#a94f5c]">{error}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
