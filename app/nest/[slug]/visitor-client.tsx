"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Compass, Eye, Heart, Lock, MessageCircle, Pencil, UserRound } from "lucide-react";
import { resolveTemplate } from "@/lib/nest-production-library";
import { resolvePublished } from "@/lib/nest-repo";
import { resolvePublishedBySlug } from "@/lib/nest-document-store";
import { getNestProfile } from "@/lib/nest-profile-store";
import { commentCount, followerCount, likeCount, onSocialChanged, recordView, viewCount } from "@/lib/nest-social";
import { formatCount } from "@/lib/nest-engagement";
import { CreatorBadge, EngagementBar, NestTags } from "@/components/nest/app-shell/discovery";
import { NestPreview } from "@/components/nest/app-shell/nest-preview";
import { FollowButton } from "@/components/nest/social/follow-button";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import type { NestDocument } from "@/lib/nest-document-types";

type Resolution =
  | { kind: "loading" }
  | { kind: "ok"; doc: NestDocument }
  | { kind: "private" }
  | { kind: "notfound" };

export function NestVisitorClient({ slug, encoded }: { slug: string; encoded?: string }) {
  const [res, setRes] = useState<Resolution>({ kind: "loading" });

  useEffect(() => {
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
  return <VisitorView doc={res.doc} slug={slug} />;
}

function Gate({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[460px] flex-col items-center justify-center gap-3 px-4 text-center">
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

function VisitorView({ doc, slug }: { doc: NestDocument; slug: string }) {
  const { ownerId } = useNestIdentity();
  const localRef = resolvePublishedBySlug(slug);
  const ownerFromDoc = doc.ownerId ?? localRef?.ref.ownerId;
  const localDoc = localRef?.doc;
  const profile = ownerFromDoc ? getNestProfile(ownerFromDoc) : null;
  const creator = { id: ownerFromDoc, username: profile?.username, displayName: profile?.displayName };
  const templateId = doc.sourceTemplateId ?? localDoc?.sourceTemplateId;
  const tpl = templateId ? resolveTemplate(templateId) : undefined;
  const tags = tpl?.tags ?? [];
  const isOwner = !!ownerId && ownerFromDoc === ownerId;
  const editDocId = localDoc?.id ?? doc.id;

  // Count the visit once per load — skip the owner's own views (real analytics).
  useEffect(() => {
    if (ownerId === undefined) return; // wait until identity resolves
    if (!isOwner) recordView(slug);
  }, [slug, isOwner, ownerId]);

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-[460px] px-4 pb-8 pt-4">
      {/* You're stepping into someone's identity space — lead with who lives here. */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <CreatorBadge creator={creator} />
        <Link href="/home" className="inline-flex items-center gap-1 rounded-full border border-timber/20 bg-white px-3 py-1.5 text-xs font-bold text-ink/60 hover:text-ink">
          <Compass className="size-3.5" /> More Nests
        </Link>
      </div>

      {/* the composed room */}
      <NestPreview doc={doc} className="aspect-[3/4] w-full" rounded="rounded-3xl border border-[#e0d5b8] shadow-sm" />

      {/* title + tags below the room */}
      <div className="mt-4 space-y-2">
        <h1 className="display text-2xl leading-tight">{doc.title}</h1>
        <NestTags tags={tags} max={4} />
      </div>

      {/* real like · comment · share — anyone can react */}
      <div className="mt-4 border-y border-timber/10 py-3">
        <EngagementBar id={slug} href={`/nest/${slug}`} tone="ink" />
      </div>

      {isOwner ? <OwnerPanel slug={slug} editDocId={editDocId} ownerId={ownerFromDoc!} /> : <VisitorPanel creatorId={creator.id} />}
    </div>
  );
}

// Owner sees their own place's real stats + management — never "Follow yourself".
function OwnerPanel({ slug, editDocId, ownerId }: { slug: string; editDocId: string; ownerId: string }) {
  const [n, setN] = useState({ views: 0, likes: 0, comments: 0, followers: 0 });
  useEffect(() => {
    const refresh = () => setN({ views: viewCount(slug), likes: likeCount(slug), comments: commentCount(slug), followers: followerCount(ownerId) });
    refresh();
    return onSocialChanged(refresh);
  }, [slug, ownerId]);

  const stats: { icon: React.ReactNode; label: string; value: number }[] = [
    { icon: <Eye className="size-4" />, label: "Views", value: n.views },
    { icon: <Heart className="size-4" />, label: "Likes", value: n.likes },
    { icon: <MessageCircle className="size-4" />, label: "Comments", value: n.comments },
    { icon: <UserRound className="size-4" />, label: "Followers", value: n.followers },
  ];
  return (
    <div className="mt-5 space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-timber/15 bg-white p-2.5 text-center shadow-soft">
            <span className="mx-auto flex size-6 items-center justify-center text-terracotta">{s.icon}</span>
            <p className="mt-1 text-sm font-black text-ink">{formatCount(s.value)}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink/45">{s.label}</p>
          </div>
        ))}
      </div>
      <Link href={`/nest-editor?document=${editDocId}`} className="flex items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-3 text-sm font-bold text-parchment"><Pencil className="size-4" /> Edit Nest</Link>
    </div>
  );
}

// Visitors can follow the creator, make their own, or wander on.
function VisitorPanel({ creatorId }: { creatorId?: string }) {
  return (
    <div className="mt-5 space-y-2">
      {creatorId ? <div className="flex justify-center"><FollowButton creatorId={creatorId} /></div> : null}
      <Link href="/create" className="block rounded-xl bg-terracotta px-4 py-3 text-center text-sm font-bold text-parchment">Create your own Nest</Link>
      <Link href="/home" className="block rounded-xl border border-timber/20 bg-white px-4 py-3 text-center text-sm font-bold text-ink/70">Wander more Nests →</Link>
    </div>
  );
}
