"use client";

import { useEffect, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { getNestSession, localSignUp, signInWithGoogle, signUpWithEmail, type NestSession } from "@/lib/nest-auth";
import { loadDoc, nestBackend, persistDoc, publish, type PublishResult } from "@/lib/nest-repo";
import { editableObjectsToPlacements } from "@/lib/nest-editor-bridge";
import { PUBLISH_VISIBILITY_OPTIONS, type NestPublishVisibility } from "@/lib/nest-production-types";
import type { EditableNestObject } from "@/lib/nest-editor-types";

// The M11/M12 publish flow, attached to the full editor. Before publishing it syncs
// the editor's current objects back into the NestDocument (so the published Nest
// reflects the edits), then runs delayed-signup → visibility → real URL.
export function PublishGate({
  documentId,
  objects,
  onClose,
}: {
  documentId?: string;
  objects: EditableNestObject[];
  onClose: () => void;
}) {
  const backend = nestBackend();
  const [session, setSession] = useState<NestSession | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visibility, setVisibility] = useState<NestPublishVisibility>("public");
  const [result, setResult] = useState<PublishResult>();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

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
    if (!documentId) { setError("No document to publish."); return; }
    setBusy(true);
    setError(undefined);
    try {
      // Sync the editor's current layout back into the NestDocument first.
      const doc = await loadDoc(documentId);
      if (doc) await persistDoc({ ...doc, placements: editableObjectsToPlacements(objects) });
      const r = await publish(documentId, visibility);
      if (r) setResult(r); else setError("Publish failed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(fullUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 sm:items-center" onClick={onClose}>
      <style>{`@keyframes publish-pop { 0% { transform: scale(0.4); opacity: 0 } 60% { transform: scale(1.12) } 100% { transform: scale(1); opacity: 1 } } .publish-pop { animation: publish-pop .42s cubic-bezier(.22,.61,.36,1) both } @media (prefers-reduced-motion: reduce) { .publish-pop { animation: none } }`}</style>
      <div className="w-full max-w-[420px] rounded-3xl border border-[#e0d5b8] bg-[#f7f0dd] p-5 text-ink shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-start justify-between">
          <h2 className="display text-2xl">{result ? "Your Nest is live" : canPublish ? "Publish your Nest" : "Create an account to publish your Nest"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-soft hover:bg-[#ece2c6]"><X className="size-5" /></button>
        </div>

        {result ? (
          <div className="space-y-3">
            {/* Celebratory confirmation (Phase 5). */}
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
            <a href={result.url} target="_blank" rel="noreferrer" className="block rounded-xl bg-[#d9913c] px-4 py-3 text-center text-sm font-bold text-white transition hover:brightness-95">View my Nest ↗</a>
            <button onClick={() => { window.location.href = "/studio"; }} className="block w-full rounded-xl border border-[#c9b98a] bg-white px-4 py-3 text-center text-sm font-bold text-ink transition hover:bg-[#f0e9d4]">Back to Studio</button>
            <p className="text-center text-[11px] text-ink-soft">Visibility: {result.visibility} · backend: {backend}</p>
          </div>
        ) : !canPublish ? (
          <div className="space-y-3">
            {backend === "local" ? (
              <>
                <p className="text-sm text-ink-soft">Your work is saved on this device. Pick a username to claim + publish it.</p>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" style={{ fontSize: 16 }} className="w-full rounded-xl border border-[#c9b98a] bg-white px-3 py-2.5" />
                <button onClick={doLocalSignup} disabled={!username.trim()} className="w-full rounded-xl bg-[#d9913c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Create account</button>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-soft">Your draft is saved. Create an account to publish it and keep it on every device.</p>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" type="email" style={{ fontSize: 16 }} className="w-full rounded-xl border border-[#c9b98a] bg-white px-3 py-2.5" />
                <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" style={{ fontSize: 16 }} className="w-full rounded-xl border border-[#c9b98a] bg-white px-3 py-2.5" />
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
            <button onClick={doPublish} disabled={busy} className="w-full rounded-xl bg-[#4d7358] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{busy ? "Publishing…" : `Publish (${visibility})`}</button>
            {error ? <p className="text-center text-xs font-bold text-[#a94f5c]">{error}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
