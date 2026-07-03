"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Compass, Lock, UserRound } from "lucide-react";
import { resolveAsset, resolveBackground, resolveTemplate } from "@/lib/nest-production-library";
import { resolvePublished } from "@/lib/nest-repo";
import { getNestProfile } from "@/lib/nest-profile-store";
import { CreatorBadge, NestTags } from "@/components/nest/app-shell/discovery";
import type { NestDocument } from "@/lib/nest-document-types";

type Resolution =
  | { kind: "loading" }
  | { kind: "ok"; doc: NestDocument }
  | { kind: "private" }
  | { kind: "notfound" };

export function NestVisitorClient({ slug, encoded }: { slug: string; encoded?: string }) {
  const [res, setRes] = useState<Resolution>({ kind: "loading" });

  useEffect(() => {
    // Backend-aware resolution (facade): a self-contained ?c= link resolves in any
    // browser; otherwise local slug (owner-gated) or Supabase slug (RLS-gated).
    let alive = true;
    resolvePublished(slug, encoded).then((r) => { if (alive) setRes(r); });
    return () => { alive = false; };
  }, [slug, encoded]);

  if (res.kind === "loading") return null;
  if (res.kind === "notfound") {
    return <Gate icon={<UserRound className="size-8 text-ink-soft" />} title="Nest not found" body="This Nest link is invalid or was never published." />;
  }
  if (res.kind === "private") {
    return <Gate icon={<Lock className="size-8 text-ink-soft" />} title="This Nest is private" body="The owner hasn't shared this Nest publicly." />;
  }
  return <VisitorView doc={res.doc} />;
}

// M17 — every empty/broken state still offers a way onward: make one, or wander more.
function Gate({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-[460px] flex-col items-center justify-center gap-3 px-4 text-center">
      {icon}
      <h1 className="display text-2xl">{title}</h1>
      <p className="max-w-xs text-sm text-ink-soft">{body}</p>
      <div className="mt-2 flex gap-2">
        <Link href="/create" className="rounded-xl bg-terracotta px-4 py-2.5 text-sm font-bold text-parchment">Create your own</Link>
        <Link href="/home" className="rounded-xl border border-timber/20 bg-white px-4 py-2.5 text-sm font-bold text-ink/70">Explore Nests</Link>
      </div>
    </div>
  );
}

function VisitorView({ doc }: { doc: NestDocument }) {
  const background = resolveBackground(doc.backgroundId);
  const profile = doc.ownerId ? getNestProfile(doc.ownerId) : null;
  const creator = { username: profile?.username, displayName: profile?.displayName };
  const tpl = doc.sourceTemplateId ? resolveTemplate(doc.sourceTemplateId) : undefined;
  const tags = tpl?.tags ?? [];

  return (
    <div className="mx-auto min-h-screen w-full max-w-[460px] px-4 pb-10 pt-4">
      {/* You're stepping into someone's identity space — lead with who lives here. */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <CreatorBadge creator={creator} />
        <Link href="/home" className="inline-flex items-center gap-1 rounded-full border border-timber/20 bg-white px-3 py-1.5 text-xs font-bold text-ink/60 hover:text-ink">
          <Compass className="size-3.5" /> More Nests
        </Link>
      </div>

      {/* the room */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl border border-[#e0d5b8] bg-[#e9e0c8] shadow-sm">
        {background ? (
          // eslint-disable-next-line @next/next/no-img-element -- local curated art
          <img src={background.variants.standard ?? background.imageUrl} alt={background.name} className="absolute inset-0 size-full object-cover" />
        ) : null}
        {doc.placements
          .slice()
          .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
          .map((p) => {
            const asset = resolveAsset(p.assetId); // resolves even archived assets → published nests never break
            if (!asset) return null;
            const widthPct = Math.max(8, Math.min(60, (p.scale ?? 0.4) * 55));
            return (
              <div key={p.id} className="absolute" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${widthPct}%`, transform: "translate(-50%, -100%)", zIndex: p.zIndex ?? 1 }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- local curated art */}
                <img src={asset.variants.standard ?? asset.cutoutUrl ?? asset.imageUrl} alt={asset.name} className="w-full object-contain drop-shadow-md" />
              </div>
            );
          })}
      </div>

      {/* title + tags below the room */}
      <div className="mt-4 space-y-2">
        <h1 className="display text-2xl leading-tight">{doc.title}</h1>
        <NestTags tags={tags} max={4} />
      </div>

      <div className="mt-5 grid gap-2">
        <Link href="/create" className="block rounded-xl bg-terracotta px-4 py-3 text-center text-sm font-bold text-parchment">Create your own Nest</Link>
        <Link href="/home" className="block rounded-xl border border-timber/20 bg-white px-4 py-3 text-center text-sm font-bold text-ink/70">Wander more Nests →</Link>
      </div>
      <p className="mt-3 text-center text-[11px] text-ink-soft">Comments, likes &amp; following arrive later.</p>
    </div>
  );
}
