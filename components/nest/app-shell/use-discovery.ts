"use client";

import { useEffect, useState } from "react";
import { getTemplates, hydrateLibrary, onProductionChanged, resolveTemplate } from "@/lib/nest-production-library";
import { listPublished, onDocsChanged, publishedUrl } from "@/lib/nest-document-store";
import { getNestProfile, onNestProfilesChanged } from "@/lib/nest-profile-store";
import { nestThumb } from "@/components/nest/app-shell/nest-card";
import { curatedItems, publishedItem, type DiscoveryItem } from "@/lib/nest-discovery";

// M17 — assembles live discovery items from the two sources we have: a creator's
// published Nests (with the real M16 creator identity resolved from ownerId) and the
// curated example Nests. Published Nests borrow tags/persona from their source template
// so they're searchable by theme. Published lead the feed; curated keep it alive.
export function useDiscovery(): { items: DiscoveryItem[]; published: DiscoveryItem[]; curated: DiscoveryItem[] } {
  const [published, setPublished] = useState<DiscoveryItem[]>([]);
  const [curated, setCurated] = useState<DiscoveryItem[]>([]);

  useEffect(() => {
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
            creator: { username: profile?.username, displayName: profile?.displayName },
            thumbnail: nestThumb(entry.doc),
            tags: tpl?.tags,
            category: tpl?.persona,
          });
        }),
      );
    };
    load();
    const offDocs = onDocsChanged(load);
    const offProfiles = onNestProfilesChanged(load);
    return () => { offDocs(); offProfiles(); };
  }, []);

  useEffect(() => {
    const load = () => setCurated(curatedItems(getTemplates({ onlyVisible: true })));
    load();
    const off = onProductionChanged(load);
    void hydrateLibrary();
    return off;
  }, []);

  return { items: [...published, ...curated], published, curated };
}
