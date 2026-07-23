"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { NestCard } from "@/components/nest/app-shell/nest-card";
import { ProfileSummary } from "@/components/nest/app-shell/profile-summary";
import { AvatarManager } from "@/components/nest/app-shell/avatar-manager";
import { CreatorLab } from "@/components/nest/app-shell/creator-lab";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import {
  listDrafts,
  listPublished,
  onDocsChanged,
  publishedUrl,
  type PublishedNest,
} from "@/lib/nest-document-store";
import type { NestDocument } from "@/lib/nest-document-types";
import { onNotificationsChanged, todayCounts } from "@/lib/nest-notifications-store";

// M15.1 — the creator's private Profile / My Place dashboard (was `/home`). Profile
// summary + Continue creating (drafts) + Published Nests + Create-New shortcut. This is
// where the editor + publish flow return to. Home is now discovery (see app/home).

export function ProfileDashboardClient() {
  const { ownerId, signedIn } = useNestIdentity();
  const [drafts, setDrafts] = useState<NestDocument[]>([]);
  const [published, setPublished] = useState<PublishedNest[]>([]);

  useEffect(() => {
    const load = () => {
      setDrafts(listDrafts(ownerId));
      setPublished(listPublished(ownerId));
    };
    load();
    return onDocsChanged(load);
  }, [ownerId]);

  const empty = drafts.length === 0 && published.length === 0;

  return (
    <div className="pt-1">
      {/* Identity stays pinned while your Nests scroll underneath — "this place is mine". */}
      <div className="sticky top-0 z-10 -mx-4 space-y-3 bg-parchment/95 px-4 pb-3 backdrop-blur">
        <header className="flex items-center justify-between">
          <h1 className="display text-3xl">Profile</h1>
          <Link href="/create" aria-label="Create a new Nest" className="flex items-center gap-1 rounded-full bg-terracotta px-3.5 py-2 text-xs font-black text-parchment shadow-soft active:scale-95">
            <Plus className="size-4" /> New
          </Link>
        </header>
        <ProfileSummary nestCount={published.length} />
        <div className="mt-4"><AvatarManager /></div>
        <div className="mt-4"><CreatorLab /></div>
      </div>

      <div className="space-y-6 pt-4">
      <ActivityToday ownerId={ownerId} />
      {empty ? (
        <div className="rounded-3xl border border-dashed border-timber/25 bg-white/60 p-8 text-center">
          <p className="display text-2xl">Your Nest awaits</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink/50">Make your first Nest — a cozy space that feels like you. It only takes a couple of minutes.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/create" className="inline-flex items-center gap-1 rounded-xl bg-terracotta px-5 py-3 text-sm font-bold text-parchment">
              <Plus className="size-4" /> Create a Nest
            </Link>
            <Link href="/home" className="inline-flex items-center rounded-xl border border-timber/20 bg-white px-5 py-3 text-sm font-bold text-ink/70">Explore examples</Link>
          </div>
        </div>
      ) : null}

      {drafts.length > 0 ? (
        <Section title="Continue creating" hint="Pick up where you left off.">
          <Grid>
            {drafts.map((doc) => (
              <NestCard key={doc.id} doc={doc} href={`/nest-editor?document=${doc.id}`} subtitle="Draft" badge="Draft" />
            ))}
          </Grid>
        </Section>
      ) : null}

      {published.length > 0 ? (
        <Section title="Published Nests" hint={signedIn ? undefined : "Sign in to keep these on every device."}>
          <Grid>
            {published.map((entry) => (
              <NestCard key={entry.ref.slug} doc={entry.doc} href={publishedUrl(entry)} subtitle={entry.ref.visibility} badge="Live" />
            ))}
          </Grid>
        </Section>
      ) : null}
      </div>
    </div>
  );
}

// Owner-only "someone interacted with your work today" summary — the M18 retention hook.
function ActivityToday({ ownerId }: { ownerId?: string }) {
  const [t, setT] = useState({ likes: 0, follows: 0, comments: 0 });
  useEffect(() => {
    if (!ownerId) return;
    const refresh = () => setT(todayCounts(ownerId));
    refresh();
    return onNotificationsChanged(refresh);
  }, [ownerId]);

  const parts = [
    t.follows ? `+${t.follows} follower${t.follows === 1 ? "" : "s"}` : null,
    t.likes ? `+${t.likes} like${t.likes === 1 ? "" : "s"}` : null,
    t.comments ? `+${t.comments} comment${t.comments === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;

  return (
    <div className="rounded-2xl border border-timber/15 bg-gradient-to-br from-[#f6e7c6] to-[#ecd9ad] px-4 py-3 shadow-soft">
      <p className="text-[11px] font-black uppercase tracking-wider text-terracotta">Today</p>
      <p className="mt-0.5 text-sm font-bold text-ink">{parts.join(" · ")}</p>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-lg font-black text-ink">{title}</h2>
        {hint ? <span className="text-[11px] text-ink/45">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}
