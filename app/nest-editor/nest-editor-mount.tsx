"use client";

import { useEffect, useState } from "react";
import { NestEditor } from "@/components/nest/editor/nest-editor";
import { loadDoc } from "@/lib/nest-repo";
import { nestDocumentToEditable } from "@/lib/nest-editor-bridge";
import type { EditableNestDocument } from "@/lib/nest-editor-types";

// Loads the onboarding NestDocument (?document=<id>) and seeds the full editor with
// its selected production background. No document → the editor opens on its default
// Golden Living Nest. This is the only editor mount in the app.
export function NestEditorMount({ documentId }: { documentId?: string }) {
  const [seed, setSeed] = useState<EditableNestDocument | undefined>(undefined);
  const [ready, setReady] = useState(!documentId);

  useEffect(() => {
    let alive = true;
    if (!documentId) { setReady(true); return; }
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
