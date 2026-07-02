"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { NestCard } from "@/components/nest/app-shell/nest-card";
import { ProfileSummary } from "@/components/nest/app-shell/profile-summary";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import {
  listDrafts,
  listPublished,
  onDocsChanged,
  publishedUrl,
  type PublishedNest,
} from "@/lib/nest-document-store";
import type { NestDocument } from "@/lib/nest-document-types";

// M15.1 — the creator's private Profile / My Place dashboard (was `/home`). Profile
// summary + Continue creating (drafts) + Published Nests + Create-New shortcut. This is
// where the editor + publish flow return to. Home is now discovery (see app/home).

export function ProfileDashboardClient() {
  const { session, signedIn } = useNestIdentity();
  const [drafts, setDrafts] = useState<NestDocument[]>([]);
  const [published, setPublished] = useState<PublishedNest[]>([]);

  useEffect(() => {
    const load = () => {
      setDrafts(listDrafts());
      setPublished(listPublished(session?.userId));
    };
    load();
    return onDocsChanged(load);
  }, [session?.userId]);

  const empty = drafts.length === 0 && published.length === 0;

  return (
    <div className="space-y-6 pt-1">
      <header className="flex items-center justify-between">
        <h1 className="display text-3xl">Profile</h1>
        <Link href="/create" aria-label="Create a new Nest" className="flex items-center gap-1 rounded-full bg-terracotta px-3.5 py-2 text-xs font-black text-parchment shadow-soft active:scale-95">
          <Plus className="size-4" /> New
        </Link>
      </header>

      <ProfileSummary nestCount={published.length} />

      {empty ? (
        <div className="rounded-3xl border border-dashed border-timber/25 bg-white/60 p-8 text-center">
          <p className="display text-2xl">Your Nest awaits</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink/50">Make your first Nest — a cozy space that feels like you. It only takes a couple of minutes.</p>
          <Link href="/create" className="mt-4 inline-flex items-center gap-1 rounded-xl bg-terracotta px-5 py-3 text-sm font-bold text-parchment">
            <Plus className="size-4" /> Create a Nest
          </Link>
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
