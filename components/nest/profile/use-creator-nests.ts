"use client";

import { useCallback, useEffect, useState } from "react";
import { nestBackend } from "@/lib/nest-repo";
import { listMyNests, listPublishedNestsByOwner, type NestListing } from "@/lib/nest/supabase-nest-repo";
import { listDrafts, listPublished, onDocsChanged, publishedUrl } from "@/lib/nest-document-store";
import type { NestDocument, NestVisibility } from "@/lib/nest-document-types";

// ── M23B §5 — one reader for "this creator's Nests" ──────────────────────────
//
// Both Profiles use it, with one difference that is the whole point:
//
//   • the OWNER sees drafts + published (RLS returns their drafts because they own them)
//   • a VISITOR sees published only (RLS will not return anyone else's drafts, and we
//     ask for the published-only query anyway, so it is enforced twice)
//
// Every row here is the real saved composition — the same NestDocument the editor wrote
// and the same one NestPreview renders — so "the Profile card matches the editor" is true
// by construction rather than by luck.

export type CreatorNest = {
  key: string;
  doc: NestDocument;
  /** Present once published — the stable, payload-free share slug. */
  slug?: string;
  visibility: NestVisibility;
  isDraft: boolean;
  /** Where the owner edits it. */
  editHref: string;
  /** Where anyone views it. Absent for an unpublished draft — there is nothing to view. */
  viewHref?: string;
};

export type CreatorNestsState = {
  nests: CreatorNest[];
  drafts: CreatorNest[];
  published: CreatorNest[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

function toCreatorNest(l: NestListing): CreatorNest {
  const isDraft = l.doc.visibility === "draft" || !l.slug;
  return {
    key: l.slug ?? l.doc.id,
    doc: l.doc,
    slug: l.slug,
    visibility: l.doc.visibility,
    isDraft,
    editHref: `/nest-editor?document=${l.doc.id}`,
    ...(l.slug && !isDraft ? { viewHref: `/nest/${l.slug}` } : {}),
  };
}

export function useCreatorNests(ownerId: string | undefined, options: { includeDrafts: boolean }): CreatorNestsState {
  const { includeDrafts } = options;
  const [nests, setNests] = useState<CreatorNest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!ownerId) { setNests([]); setLoading(false); return; }
    let alive = true;

    if (nestBackend() !== "supabase") {
      const load = () => {
        const local: CreatorNest[] = [
          ...(includeDrafts
            ? listDrafts(ownerId).map((doc) => ({
                key: doc.id,
                doc,
                visibility: doc.visibility,
                isDraft: true,
                editHref: `/nest-editor?document=${doc.id}`,
              }))
            : []),
          ...listPublished(ownerId).map((entry) => ({
            key: entry.ref.slug,
            doc: entry.doc,
            slug: entry.ref.slug,
            visibility: entry.ref.visibility,
            isDraft: false,
            editHref: `/nest-editor?document=${entry.doc.id}`,
            viewHref: publishedUrl(entry),
          })),
        ];
        setNests(local);
        setLoading(false);
      };
      load();
      return onDocsChanged(load);
    }

    setLoading(true);
    void (async () => {
      try {
        const listings = includeDrafts ? await listMyNests() : await listPublishedNestsByOwner(ownerId);
        if (!alive) return;
        setError(null);
        setNests(listings.map(toCreatorNest));
      } catch (e) {
        if (!alive) return;
        // Loud: an empty Profile must not be how a creator finds out the backend is down.
        setError(e instanceof Error ? e.message : "Your Nests could not be loaded.");
        setNests([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [ownerId, includeDrafts, nonce]);

  return {
    nests,
    drafts: nests.filter((n) => n.isDraft),
    published: nests.filter((n) => !n.isDraft),
    loading,
    error,
    reload,
  };
}
