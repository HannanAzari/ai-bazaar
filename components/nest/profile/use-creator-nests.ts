"use client";

import { useCallback, useEffect, useState } from "react";
import { nestBackend } from "@/lib/nest-repo";
import { deleteNest, listMyNests, listPublishedNestsByOwner, nestIdsWithDrafts, type NestListing } from "@/lib/nest/supabase-nest-repo";
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
  /** M24B §4 — published, but with unpublished edits waiting. */
  hasPendingDraft?: boolean;
  /**
   * M24B §1 — saved before explicit w/h existed, so its geometry is still DERIVED rather
   * than replayed. It renders exactly as it always has; it simply will not be
   * pixel-identical to the editor until the creator saves it once. We never backfill:
   * inferring the original boxes would be guessing at what they intended.
   */
  isLegacyLayout?: boolean;
};

export type CreatorNestsState = {
  nests: CreatorNest[];
  drafts: CreatorNest[];
  published: CreatorNest[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** M24B §6 — delete a Nest (draft, published or unlisted). Removes it everywhere. */
  remove: (nestId: string) => Promise<void>;
};

/** A placement with no explicit box predates M24's geometry contract. */
function hasLegacyLayout(l: NestListing): boolean {
  return l.doc.placements.some((p) => p.w == null || p.h == null);
}

function toCreatorNest(l: NestListing): CreatorNest {
  const isDraft = l.doc.visibility === "draft" || !l.slug;
  return {
    isLegacyLayout: hasLegacyLayout(l),
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
        // M24B §4 — mark which published Nests have unpublished edits waiting.
        const withDrafts = includeDrafts ? await nestIdsWithDrafts(ownerId) : new Set<string>();
        if (!alive) return;
        setError(null);
        setNests(listings.map((l) => ({ ...toCreatorNest(l), hasPendingDraft: withDrafts.has(l.doc.id) })));
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

  const remove = useCallback(
    async (nestId: string) => {
      await deleteNest(nestId);
      // Drop it locally at once so the Profile updates without waiting for a refetch.
      setNests((prev) => prev.filter((n) => n.doc.id !== nestId));
    },
    [],
  );

  return {
    nests,
    drafts: nests.filter((n) => n.isDraft),
    published: nests.filter((n) => !n.isDraft),
    loading,
    error,
    reload,
    remove,
  };
}
