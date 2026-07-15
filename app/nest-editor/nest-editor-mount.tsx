"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NestEditor } from "@/components/nest/editor/nest-editor";
import { canEditDoc } from "@/lib/nest-document-store";
import { loadDoc } from "@/lib/nest-repo";
import { nestDocumentToEditable } from "@/lib/nest-editor-bridge";
import { loadDraft } from "@/lib/nest-editor-storage";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import type { EditableNestDocument } from "@/lib/nest-editor-types";

// Loads the NestDocument (?document=<id>) and seeds the full editor. M16: enforces
// ownership — only the owner (or an un-owned guest draft) opens the editor; anyone
// else gets a read-only notice instead of editing another creator's Nest.
export function NestEditorMount({ documentId, pickAssetId }: { documentId?: string; pickAssetId?: string }) {
  const { ownerId, loading: idLoading } = useNestIdentity();
  const [seed, setSeed] = useState<EditableNestDocument | undefined>(undefined);
  const [state, setState] = useState<"loading" | "ready" | "denied">(documentId ? "loading" : "ready");

  useEffect(() => {
    if (!documentId) { setState("ready"); return; }
    if (idLoading) return; // wait for identity so ownership isn't misjudged
    let alive = true;
    loadDoc(documentId).then((doc) => {
      if (!alive) return;
      if (doc && !canEditDoc(doc, ownerId)) { setState("denied"); return; }
      // M14: prefer the editor's autosaved draft (full editable document); fall back to
      // the persisted NestDocument (first open from Create, or another device).
      const draft = loadDraft(documentId);
      if (draft.ok && draft.doc) setSeed(draft.doc);
      else if (doc) setSeed(nestDocumentToEditable(doc));
      setState("ready");
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
  if (state === "loading") return null;
  return <NestEditor seed={seed} documentId={documentId} pickAssetId={pickAssetId} />;
}
