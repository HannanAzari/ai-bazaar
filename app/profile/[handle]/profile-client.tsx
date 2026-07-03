"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/nest/app-shell/profile-summary";
import { NestCard } from "@/components/nest/app-shell/nest-card";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { getNestProfile, onNestProfilesChanged, resolveByUsername, type NestProfile, type NestSocials } from "@/lib/nest-profile-store";
import { listPublished, onDocsChanged, publishedUrl, type PublishedNest } from "@/lib/nest-document-store";

// M16 — the public creator profile at /@<handle> (served from /profile/<handle> via a
// rewrite): profile hero (avatar · display name · @username · bio · links) + the
// creator's published Nests. Resolution is local in the current backend; the Supabase
// path resolves it from the `profiles` table by the cutover (see M16 known limitations).

export function ProfileClient({ handle }: { handle: string }) {
  const { ownerId } = useNestIdentity();
  const [profile, setProfile] = useState<NestProfile | null | undefined>(undefined); // undefined = resolving
  const [published, setPublished] = useState<PublishedNest[]>([]);

  useEffect(() => {
    const resolve = () => setProfile(resolveByUsername(handle) ?? null);
    resolve();
    return onNestProfilesChanged(resolve);
  }, [handle]);

  useEffect(() => {
    if (!profile) return;
    const load = () => setPublished(listPublished(profile.userId));
    load();
    return onDocsChanged(load);
  }, [profile]);

  if (profile === undefined) {
    return <div className="mt-10 h-24 animate-pulse rounded-3xl border border-timber/15 bg-white/60" />;
  }

  if (profile === null) {
    return (
      <div className="mt-10 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-timber/25 bg-white/60 p-10 text-center">
        <Avatar />
        <p className="display text-2xl">No Nest here yet</p>
        <p className="max-w-xs text-sm text-ink/50">We couldn&rsquo;t find <span className="font-bold">@{handle}</span>. The handle may be free to claim.</p>
        <Link href="/create" className="mt-2 rounded-xl bg-terracotta px-5 py-3 text-sm font-bold text-parchment">Create your Nest</Link>
      </div>
    );
  }

  const isOwn = ownerId === profile.userId;
  // Refresh from the store so a just-saved bio/link shows immediately for the owner.
  const live = getNestProfile(profile.userId) ?? profile;
  const links = socialLinks(live.socials);

  return (
    <div className="space-y-6 pt-1">
      <header className="rounded-3xl border border-timber/15 bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <Avatar username={live.username} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-black text-ink">{live.displayName ?? `@${live.username}`}</h1>
            {live.displayName ? <p className="truncate text-sm text-ink/45">@{live.username}</p> : null}
            <p className="truncate text-sm text-ink/50">{live.bio ?? "A cozy corner on Nestudio."}</p>
          </div>
        </div>
        {links.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {links.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="rounded-full border border-timber/20 bg-parchment px-3 py-1.5 text-xs font-bold text-ink/70 hover:text-ink">{l.label} ↗</a>
            ))}
          </div>
        ) : null}
        <div className="mt-4 flex items-center gap-6 border-t border-timber/10 pt-3">
          <div>
            <p className="text-lg font-black text-ink">{published.length}</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink/45">{published.length === 1 ? "Nest" : "Nests"}</p>
          </div>
          {isOwn ? <Link href="/profile" className="ml-auto self-center text-xs font-bold text-terracotta hover:underline">Manage in Profile →</Link> : null}
        </div>
      </header>

      <section aria-label="Published Nests">
        <h2 className="mb-2 text-lg font-black text-ink">Published Nests</h2>
        {published.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-timber/25 bg-white/60 p-6 text-center text-sm text-ink/50">No published Nests yet.</p>
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
