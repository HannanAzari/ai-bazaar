"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/nest/app-shell/profile-summary";
import { NestCard } from "@/components/nest/app-shell/nest-card";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { getNestProfile, onNestProfilesChanged, resolveByUsername, type NestProfile, type NestSocials } from "@/lib/nest-profile-store";
import { listPublished, onDocsChanged, publishedUrl, type PublishedNest } from "@/lib/nest-document-store";
import { resolveTemplate } from "@/lib/nest-production-library";
import { formatCount } from "@/lib/nest-engagement";
import { followerCount, followingCount, onSocialChanged } from "@/lib/nest-social";
import { FollowButton } from "@/components/nest/social/follow-button";
import { HouseFront } from "@/components/nest/village/house-front";
import { deriveHouse } from "@/lib/nest-house";

// M19 — /@<handle> is now an *arrival*, not a profile page. You land at the creator's
// House (front-facing scene + door), can step inside (Enter Nest → door transition), or
// wander to the wider village. Below the house sit the details (stats · links · follow)
// and the "rooms in this house" — the creator's published Nests. This preserves M16
// identity + M18 social; it re-frames the profile as a place. (Served from /@handle via
// the next.config rewrite; the visitor-facing url stays hannan.nestud.io → /@hannan.)

export function ProfileClient({ handle }: { handle: string }) {
  const router = useRouter();
  const { ownerId } = useNestIdentity();
  const [profile, setProfile] = useState<NestProfile | null | undefined>(undefined); // undefined = resolving
  const [published, setPublished] = useState<PublishedNest[]>([]);
  const [social, setSocial] = useState({ followers: 0, following: 0 });

  useEffect(() => {
    const resolve = () => setProfile(resolveByUsername(handle) ?? null);
    resolve();
    return onNestProfilesChanged(resolve);
  }, [handle]);

  useEffect(() => {
    if (!profile) return;
    const refresh = () => setSocial({ followers: followerCount(profile.userId), following: followingCount(profile.userId) });
    refresh();
    return onSocialChanged(refresh);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const load = () => setPublished(listPublished(profile.userId));
    load();
    return onDocsChanged(load);
  }, [profile]);

  // Refresh from the store so a just-saved bio/link shows immediately for the owner.
  const live = profile ? getNestProfile(profile.userId) ?? profile : null;

  const house = useMemo(() => {
    if (!live) return null;
    const newest = published[0];
    const tpl = newest?.doc.sourceTemplateId ? resolveTemplate(newest.doc.sourceTemplateId) : undefined;
    return deriveHouse({
      creator: { id: live.userId, username: live.username, displayName: live.displayName },
      persona: tpl?.persona,
      bio: live.bio,
      nestHref: newest ? publishedUrl(newest) : undefined,
      latestNestTitle: newest?.doc.title,
    });
  }, [live, published]);

  if (profile === undefined) {
    return <div className="mt-10 h-24 animate-pulse rounded-3xl border border-timber/15 bg-white/60" />;
  }

  if (profile === null || !live || !house) {
    return (
      <div className="mt-10 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-timber/25 bg-white/60 p-10 text-center">
        <Avatar />
        <p className="display text-2xl">No house here yet</p>
        <p className="max-w-xs text-sm text-ink/50">We couldn&rsquo;t find <span className="font-bold">@{handle}</span>. The handle may be free to claim.</p>
        <div className="mt-2 flex gap-2">
          <Link href="/create" className="rounded-xl bg-terracotta px-5 py-3 text-sm font-bold text-parchment">Build your house</Link>
          <Link href="/village" className="rounded-xl border border-timber/20 bg-white px-5 py-3 text-sm font-bold text-ink/70">Visit the village</Link>
        </div>
      </div>
    );
  }

  const isOwn = ownerId === profile.userId;
  const links = socialLinks(live.socials);

  return (
    <div className="space-y-5 pt-1">
      {/* The house is the identity — you arrive at a place. */}
      <HouseFront
        house={house}
        className="rounded-[2rem] border border-timber/15 pb-6 shadow-lift"
        onBack={() => router.push("/village")}
        backLabel="The village"
      />

      {/* details — stats · links · follow (M16 identity + M18 social preserved) */}
      <header className="rounded-3xl border border-timber/15 bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <Avatar username={live.username} size={52} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-black text-ink">{live.displayName ?? `@${live.username}`}</h1>
            <p className="truncate text-sm text-ink/45">@{live.username}</p>
          </div>
          {isOwn ? <Link href="/profile" className="self-center text-xs font-bold text-terracotta hover:underline">Manage →</Link> : <span className="self-center"><FollowButton creatorId={profile.userId} /></span>}
        </div>
        {links.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {links.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="rounded-full border border-timber/20 bg-parchment px-3 py-1.5 text-xs font-bold text-ink/70 hover:text-ink">{l.label} ↗</a>
            ))}
          </div>
        ) : null}
        <div className="mt-4 flex items-center gap-5 border-t border-timber/10 pt-3">
          <ProfileStat value={formatCount(social.followers)} label="Followers" />
          <ProfileStat value={formatCount(social.following)} label="Following" />
          <ProfileStat value={String(published.length)} label={published.length === 1 ? "Room" : "Rooms"} />
        </div>
      </header>

      {/* the Nests inside this house */}
      <section aria-label="Rooms in this house">
        <h2 className="mb-2 text-lg font-black text-ink">Rooms in this house</h2>
        {published.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-timber/25 bg-white/60 p-6 text-center text-sm text-ink/50">No rooms open yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {published.map((entry) => (
              <NestCard key={entry.ref.slug} doc={entry.doc} href={publishedUrl(entry)} subtitle={entry.ref.visibility} badge="Live" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProfileStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-lg font-black leading-none text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-ink/45">{label}</p>
    </div>
  );
}

/** Turn stored social handles/URLs into labelled outbound links. */
function socialLinks(socials?: NestSocials): { label: string; href: string }[] {
  if (!socials) return [];
  const ensureUrl = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v.replace(/^@/, "")}`);
  const out: { label: string; href: string }[] = [];
  if (socials.website) out.push({ label: "Website", href: ensureUrl(socials.website) });
  if (socials.github) out.push({ label: "GitHub", href: ensureUrl(socials.github.includes("/") ? socials.github : `github.com/${socials.github.replace(/^@/, "")}`) });
  if (socials.twitter) out.push({ label: "Twitter", href: ensureUrl(socials.twitter.includes("/") ? socials.twitter : `x.com/${socials.twitter.replace(/^@/, "")}`) });
  if (socials.youtube) out.push({ label: "YouTube", href: ensureUrl(socials.youtube) });
  return out;
}
