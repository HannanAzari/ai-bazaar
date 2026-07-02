"use client";

import { useEffect, useState } from "react";
import { NestEditor } from "@/components/nest/editor/nest-editor";
import { loadDoc } from "@/lib/nest-repo";
import { nestDocumentToEditable } from "@/lib/nest-editor-bridge";
import { loadDraft } from "@/lib/nest-editor-storage";
import type { EditableNestDocument } from "@/lib/nest-editor-types";

// Loads the onboarding NestDocument (?document=<id>) and seeds the full editor with
// its selected production background. No document → the editor opens on a clean
// production starter Nest. This is the only editor mount in the app.
export function NestEditorMount({ documentId }: { documentId?: string }) {
  const [seed, setSeed] = useState<EditableNestDocument | undefined>(undefined);
  const [ready, setReady] = useState(!documentId);

  useEffect(() => {
    let alive = true;
    if (!documentId) { setReady(true); return; }
    // M14: prefer the editor's autosaved draft — it holds the FULL editable document
    // (overlays, rotation, surfaces, bindings, scene graph), so reopening a Nest restores
    // exactly what the creator last saw. Fall back to the persisted NestDocument (first
    // open from onboarding, or another device) when there's no local draft.
    const draft = loadDraft(documentId);
    if (draft.ok && draft.doc) { setSeed(draft.doc); setReady(true); return () => { alive = false; }; }
    loadDoc(documentId).then((doc) => {
      if (!alive) return;
      if (doc) setSeed(nestDocumentToEditable(doc));
      setReady(true);
    });
    return () => { alive = false; };
  }, [documentId]);

  if (!ready) return null; // brief: wait for the document before mounting the editor
  return <NestEditor seed={seed} documentId={documentId} />;
}
