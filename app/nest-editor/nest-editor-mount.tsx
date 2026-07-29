"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NestEditor } from "@/components/nest/editor/nest-editor";
import { canEditDoc } from "@/lib/nest-document-store";
import { loadDoc, loadPendingDraft } from "@/lib/nest-repo";
import { nestDocumentToEditable } from "@/lib/nest-editor-bridge";
import { loadDraft } from "@/lib/nest-editor-storage";
import { reconcileDraft } from "@/lib/nest-draft-reconcile";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import type { EditableNestDocument } from "@/lib/nest-editor-types";

// Loads the NestDocument (?document=<id>) and seeds the full editor. M16: enforces
// ownership — only the owner (or an un-owned guest draft) opens the editor; anyone
// else gets a read-only notice instead of editing another creator's Nest.
export function NestEditorMount({ documentId, pickAssetId }: { documentId?: string; pickAssetId?: string }) {
  const { ownerId, loading: idLoading } = useNestIdentity();
  const [seed, setSeed] = useState<EditableNestDocument | undefined>(undefined);
  const [state, setState] = useState<"loading" | "ready" | "denied" | "error">(documentId ? "loading" : "ready");
  const [error, setError] = useState<string | null>(null);
  const [restoredUnsaved, setRestoredUnsaved] = useState(false);

  useEffect(() => {
    if (!documentId) { setState("ready"); return; }
    if (idLoading) return; // wait for identity so ownership isn't misjudged
    let alive = true;
    Promise.all([loadDoc(documentId), loadPendingDraft(documentId).catch(() => null)])
      .then(([liveDoc, pendingDraft]) => {
        if (!alive) return;
        if (liveDoc && !canEditDoc(liveDoc, ownerId)) { setState("denied"); return; }
        // M24B §4 — reopen the creator's unpublished work, not the live version. This is
        // what makes editing across several sessions possible: the published Nest keeps
        // serving visitors while the draft is what you come back to.
        const doc = liveDoc && pendingDraft
          ? { ...liveDoc, title: pendingDraft.title, backgroundId: pendingDraft.backgroundId, placements: pendingDraft.placements }
          : liveDoc;

        // M23B §4 — the canonical document wins unless the autosave is strictly newer,
        // i.e. unless the creator left with unsaved work. M14 preferred the autosave
        // unconditionally, which is exactly how the editor and the Profile card drifted.
        const draft = loadDraft(documentId);
        const decision = reconcileDraft({
          canonicalUpdatedAt: doc?.updatedAt,
          autosaveUpdatedAt: draft.ok ? draft.doc?.updatedAt : undefined,
        });

        if (decision.choice === "autosave" && draft.ok && draft.doc) {
          setSeed(draft.doc);
          // Surfaced, never silent: the creator is told their unsaved work came back.
          setRestoredUnsaved(decision.restoredUnsaved && !!doc);
        } else if (doc) {
          setSeed(nestDocumentToEditable(doc));
        } else if (draft.ok && draft.doc) {
          setSeed(draft.doc);
        }
        setState("ready");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        // Loud (D-10): we do NOT silently open the local autosave as though the server
        // had answered — the creator would edit a copy nobody else can see.
        setError(e instanceof Error ? e.message : "This Nest could not be loaded.");
        setState("error");
      });
    return () => { alive = false; };
  }, [documentId, ownerId, idLoading]);

  if (state === "denied") {
    return (
      <div className="grid min-h-screen place-items-center bg-parchment p-6 text-center">
        <div>
          <p className="display text-2xl">This Nest isn&rsquo;t yours to edit</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-ink/55">Only its creator can edit it. You can still explore and share published Nests.</p>
          <Link href="/home" className="mt-4 inline-flex rounded-xl bg-terracotta px-5 py-3 text-sm font-bold text-parchment">Back to Home</Link>
        </div>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="grid min-h-screen place-items-center bg-parchment p-6 text-center">
        <div>
          <p className="display text-2xl">We couldn&rsquo;t open this Nest</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-ink/55">
            Your work is safe — we just couldn&rsquo;t reach the server, so we haven&rsquo;t opened a
            copy that might not match. {error}
          </p>
          <button onClick={() => window.location.reload()} className="mt-4 inline-flex rounded-xl bg-terracotta px-5 py-3 text-sm font-bold text-parchment">
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (state === "loading") return null;
  return (
    <>
      {restoredUnsaved ? <UnsavedRestoredBanner onDismiss={() => setRestoredUnsaved(false)} /> : null}
      <NestEditor seed={seed} documentId={documentId} pickAssetId={pickAssetId} />
    </>
  );
}

// §4: the divergence is announced rather than hidden. If this banner appears, the editor
// is showing newer work than the creator's Profile — and Save is what closes the gap.
function UnsavedRestoredBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed inset-x-0 top-0 z-[70] mx-auto max-w-[460px] px-3 pt-[max(env(safe-area-inset-top),0.5rem)]">
      <div className="flex items-start gap-2 rounded-2xl border border-[#c9b98a] bg-[#fbf5e4] px-3 py-2.5 shadow-lift">
        <p className="min-w-0 flex-1 text-[12px] leading-snug text-ink/75">
          <strong className="font-black">Unsaved changes restored.</strong> Your Profile still shows
          the last version you saved — press Save to update it.
        </p>
        <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 rounded-lg px-1.5 text-ink/40">×</button>
      </div>
    </div>
  );
}
