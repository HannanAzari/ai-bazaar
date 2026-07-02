"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserRound, Lock } from "lucide-react";
import { resolveAsset, resolveBackground } from "@/lib/nest-production-library";
import { resolvePublished } from "@/lib/nest-repo";
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

function Gate({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-[460px] flex-col items-center justify-center gap-3 px-4 text-center">
      {icon}
      <h1 className="display text-2xl">{title}</h1>
      <p className="max-w-xs text-sm text-ink-soft">{body}</p>
      <Link href="/create" className="mt-2 rounded-xl bg-[#d9913c] px-4 py-2 text-sm font-bold text-white">Create your own Nest</Link>
    </div>
  );
}

function VisitorView({ doc }: { doc: NestDocument }) {
  const background = resolveBackground(doc.backgroundId);
  return (
    <div className="mx-auto min-h-screen w-full max-w-[460px] px-4 pb-10 pt-4">
      {/* profile chip (view profile · follow disabled — no social yet) */}
      <div className="mb-3 flex items-center gap-3 rounded-2xl border border-[#e0d5b8] bg-[#efe7cf] px-3 py-2">
        <span className="flex size-9 items-center justify-center rounded-full bg-[#dcd0ad]"><UserRound className="size-5 text-ink-soft" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{doc.title}</p>
          <p className="text-xs text-ink-soft">A Nestudio creator</p>
        </div>
        <button disabled title="Following arrives in a later sprint" className="cursor-not-allowed rounded-lg border border-[#c9b98a] bg-white px-3 py-1.5 text-xs font-bold text-ink-soft opacity-70">Follow</button>
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

      <p className="mt-3 text-center text-xs text-ink-soft">You&rsquo;re visiting a published Nest · comments, likes &amp; following arrive later.</p>
      <Link href="/create" className="mt-3 block rounded-xl bg-[#d9913c] px-4 py-3 text-center text-sm font-bold text-white">Create your own Nest</Link>
    </div>
  );
}
