import Link from "next/link";
import { ArrowLeft, Hash } from "lucide-react";
import { TagDetailClient } from "@/components/tag-detail-client";
import { Footer } from "@/components/footer";
import { shops } from "@/lib/data";
import { normalizeTag, tagCounts } from "@/lib/tags";

// Pre-render the tags present in seed data; owner-added tags resolve on demand.
export function generateStaticParams() {
  return tagCounts(shops).map((entry) => ({ tag: entry.tag }));
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: raw } = await params;
  const tag = normalizeTag(decodeURIComponent(raw));

  return (
    <>
      <section className="shell py-10">
        <Link href="/tags" className="inline-flex items-center gap-2 text-sm font-bold text-ink-soft hover:text-terracotta">
          <ArrowLeft size={16} /> All tags
        </Link>
        <div className="mt-5 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-terracotta/10 text-terracotta"><Hash size={24} /></span>
          <div>
            <p className="eyebrow text-terracotta">Tag</p>
            <h1 className="display text-4xl sm:text-5xl">{tag}</h1>
          </div>
        </div>
        <TagDetailClient tag={tag} />
      </section>
      <Footer />
    </>
  );
}
