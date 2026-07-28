"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getTemplates, hydrateLibrary, onProductionChanged, resolveTemplate } from "@/lib/nest-production-library";
import { listPublished, onDocsChanged, publishedUrl } from "@/lib/nest-document-store";
import { getNestProfile, onNestProfilesChanged } from "@/lib/nest-profile-store";
import { curatedItems, publishedItem, type DiscoveryItem } from "@/lib/nest-discovery";
import { nestBackend } from "@/lib/nest-repo";
import { listPublicNests, type NestListing } from "@/lib/nest/supabase-nest-repo";
import { getProfiles, type CreatorProfile } from "@/lib/nest/supabase-profile-repo";

// ── M23B §3/§5 — discovery reads the SHARED store ────────────────────────────
//
// This hook used to call `listPublished()` — localStorage — with no owner filter, so the
// "feed" was literally whatever the current browser had published. That is the single
// reason Account B could never see Account A's Nest.
//
// It now queries Supabase for every world-readable Nest and resolves each creator from
// the shared `profiles` table, so a normal user's Nest is discoverable by anyone.
// Curated example Nests remain, but ONLY as clearly-separated fallback content: they are
// appended after real Nests and can never replace or bury them.

export type DiscoveryState = {
  items: DiscoveryItem[];
  published: DiscoveryItem[];
  curated: DiscoveryItem[];
  loading: boolean;
  /** A backend failure, surfaced rather than swallowed (D-10). */
  error: string | null;
  reload: () => void;
};

/** A server listing + its resolved creator → the shape Home/Explore/Village render. */
function listingToItem(listing: NestListing, creator: CreatorProfile | undefined): DiscoveryItem {
  const tpl = listing.doc.sourceTemplateId ? resolveTemplate(listing.doc.sourceTemplateId) : undefined;
  return publishedItem({
    slug: listing.slug!,
    title: listing.doc.title,
    visibility: listing.doc.visibility,
    // Payload-free. The viewer resolves this slug through RLS — no `?c=` blob.
    href: `/nest/${listing.slug}`,
    creator: {
      id: listing.ownerId,
      username: creator?.username,
      displayName: creator?.displayName,
      houseStyle: creator?.houseStyle,
    },
    doc: listing.doc,
    tags: tpl?.tags,
    category: tpl?.persona,
  });
}

export function useDiscovery(): DiscoveryState {
  const [published, setPublished] = useState<DiscoveryItem[]>([]);
  const [curated, setCurated] = useState<DiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // ── Published Nests ────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;

    // Local/demo backend: the old localStorage path, unchanged.
    if (nestBackend() !== "supabase") {
      const load = () => {
        setPublished(
          listPublished().map((entry) => {
            const profile = entry.ref.ownerId ? getNestProfile(entry.ref.ownerId) : null;
            const tpl = entry.doc.sourceTemplateId ? resolveTemplate(entry.doc.sourceTemplateId) : undefined;
            return publishedItem({
              slug: entry.ref.slug,
              title: entry.doc.title,
              visibility: entry.ref.visibility,
              href: publishedUrl(entry),
              creator: { id: entry.ref.ownerId, username: profile?.username, displayName: profile?.displayName },
              doc: entry.doc,
              tags: tpl?.tags,
              category: tpl?.persona,
            });
          }),
        );
        setLoading(false);
      };
      load();
      const offDocs = onDocsChanged(load);
      const offProfiles = onNestProfilesChanged(load);
      return () => { alive = false; offDocs(); offProfiles(); };
    }

    // ── Supabase backend: the real, cross-account feed ───────────────────────
    setLoading(true);
    void (async () => {
      try {
        const listings = (await listPublicNests()).filter((l) => !!l.slug);
        // One query for every creator in the feed, not one per card.
        const creators = await getProfiles(listings.map((l) => l.ownerId));
        if (!alive) return;
        setError(null);
        setPublished(listings.map((l) => listingToItem(l, creators.get(l.ownerId))));
      } catch (e) {
        if (!alive) return;
        // Loud: Home says "we couldn't load Nests" rather than showing an empty feed
        // that looks like nobody has published anything.
        setError(e instanceof Error ? e.message : "Nests could not be loaded.");
        setPublished([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [nonce]);

  // ── Curated examples (fallback content only) ───────────────────────────────
  useEffect(() => {
    const load = () => setCurated(curatedItems(getTemplates({ onlyVisible: true })));
    load();
    const off = onProductionChanged(load);
    void hydrateLibrary();
    return off;
  }, []);

  // Real content always leads.
  const items = useMemo(() => [...published, ...curated], [published, curated]);

  return { items, published, curated, loading, error, reload };
}
