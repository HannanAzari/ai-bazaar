"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DoorClosed, Eye, Heart, Lock, MessageCircle, Pencil, UserRound } from "lucide-react";
import { styleFor } from "@/lib/nest-house";
import { DoorTransition } from "@/components/nest/village/enter-transition";
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
  const router = useRouter();
  const { ownerId } = useNestIdentity();
  const [leaving, setLeaving] = useState(false);
  const localRef = resolvePublishedBySlug(slug);
  const ownerFromDoc = doc.ownerId ?? localRef?.ref.ownerId;
  const localDoc = localRef?.doc;
  const profile = ownerFromDoc ? getNestProfile(ownerFromDoc) : null;
  const creator = { id: ownerFromDoc, username: profile?.username, displayName: profile?.displayName };
  const templateId = doc.sourceTemplateId ?? localDoc?.sourceTemplateId;
  const tpl = templateId ? resolveTemplate(templateId) : undefined;
  const tags = tpl?.tags ?? [];
  const style = styleFor(tpl?.persona);

  // M19.1 return journey — the door closes behind you, then back to where you came
  // (the house front / the village), not an abrupt jump.
  function leave() {
    setLeaving(true);
  }
  function afterLeave() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else if (creator.username) router.push(`/@${creator.username}`);
    else router.push("/village");
  }
  const isOwner = !!ownerId && ownerFromDoc === ownerId;
  const editDocId = localDoc?.id ?? doc.id;

  // Count the visit once per load — skip the owner's own views (real analytics).
  useEffect(() => {
    if (ownerId === undefined) return; // wait until identity resolves
    if (!isOwner) recordView(slug);
  }, [slug, isOwner, ownerId]);

  return (
    // Beta Polish 1 — one phone screen, no page scroll: identity (top) · room (center) ·
    // actions (bottom). The room is a bounded middle region, so furniture can never overlap
    // the header or the action buttons.
    <div
      className="mx-auto flex h-[100dvh] w-full max-w-[460px] flex-col overflow-hidden px-4"
      style={{ paddingTop: "max(env(safe-area-inset-top), 0.5rem)", paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
    >
      {leaving ? <DoorTransition style={style} mode="exit" onDone={afterLeave} label="Heading back out…" /> : null}

      {/* TOP — who lives here */}
      <header className="flex flex-none items-center justify-between gap-3 py-2.5">
        <CreatorBadge creator={creator} />
        <button onClick={leave} className="inline-flex items-center gap-1 rounded-full border border-timber/20 bg-white px-3 py-1.5 text-xs font-bold text-ink/60 hover:text-ink active:scale-95">
          <DoorClosed className="size-3.5" /> Exit
        </button>
      </header>

      {/* CENTER — the composed room fills the space; title + tags sit on its base */}
      <div className="relative min-h-0 flex-1">
        <NestPreview doc={doc} className="size-full" rounded="rounded-3xl border border-[#e0d5b8] shadow-sm" safe={{ bottom: 0.12 }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-3xl bg-gradient-to-t from-black/60 via-black/25 to-transparent p-4 pt-12">
          <h1 className="display text-2xl leading-tight text-white drop-shadow-sm">{doc.title}</h1>
          {tags.length > 0 ? <div className="mt-1.5"><NestTags tags={tags} max={4} tone="light" /></div> : null}
        </div>
      </div>

      {/* BOTTOM — actions */}
      {isOwner ? (
        <OwnerPanel slug={slug} editDocId={editDocId} ownerId={ownerFromDoc!} />
      ) : (
        <footer className="flex-none space-y-2 pt-2.5">
          <div className="flex items-center justify-between gap-3 border-y border-timber/10 py-2">
            <EngagementBar id={slug} href={`/nest/${slug}`} tone="ink" />
            {creator.id ? <FollowButton creatorId={creator.id} /> : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/create" className="rounded-xl bg-terracotta px-4 py-2.5 text-center text-sm font-bold text-parchment active:scale-95">Create your own</Link>
            <Link href="/home" className="rounded-xl border border-timber/20 bg-white px-4 py-2.5 text-center text-sm font-bold text-ink/70 active:scale-95">Wander Nests →</Link>
          </div>
        </footer>
      )}
    </div>
  );
}

// Owner sees their own place's real stats + management on one screen — never "Follow yourself".
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
    <footer className="flex-none space-y-2 pt-2.5">
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-timber/15 bg-white p-2 text-center shadow-soft">
            <span className="mx-auto flex size-5 items-center justify-center text-terracotta">{s.icon}</span>
            <p className="mt-0.5 text-sm font-black text-ink">{formatCount(s.value)}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink/45">{s.label}</p>
          </div>
        ))}
      </div>
      <Link href={`/nest-editor?document=${editDocId}`} className="flex items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-parchment active:scale-95"><Pencil className="size-4" /> Edit Nest</Link>
    </footer>
  );
}
