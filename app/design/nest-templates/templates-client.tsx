"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getTemplates, onProductionChanged, resolveBackground } from "@/lib/nest-production-library";
import { createFromTemplate } from "@/lib/nest-repo";
import { isOnboardingVisible, type ProductionLibraryStatus, type ProductionTemplate } from "@/lib/nest-production-types";

const STATUS_STYLE: Record<ProductionLibraryStatus, string> = {
  draft: "bg-[#dcd0ad] text-ink-soft",
  approved: "bg-[#4d7358] text-white",
  featured: "bg-[#d9913c] text-white",
  hidden: "bg-[#8a8172] text-white",
  archived: "bg-[#a94f5c] text-white",
};

export function NestTemplatesClient() {
  const [tick, setTick] = useState(0);
  const [onlyPublished, setOnlyPublished] = useState(false);

  useEffect(() => onProductionChanged(() => setTick((t) => t + 1)), []);

  const templates = useMemo(() => {
    void tick;
    return getTemplates({ onlyVisible: onlyPublished });
  }, [tick, onlyPublished]);

  return (
    <section className="shell space-y-6 py-8">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <p className="eyebrow text-terracotta">Nest templates · internal</p>
          <h1 className="display text-3xl">Template gallery</h1>
          <p className="mt-1 text-sm text-ink-soft">Every production template + curation status. Onboarding only shows approved/featured.</p>
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyPublished} onChange={(e) => setOnlyPublished(e.target.checked)} />
          Only published
        </label>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => <TemplateCard key={t.id} t={t} />)}
        {templates.length === 0 ? <p className="text-sm text-ink-soft">No templates.</p> : null}
      </div>
    </section>
  );
}

function TemplateCard({ t }: { t: ProductionTemplate }) {
  const router = useRouter();
  const bg = resolveBackground(t.backgroundId);
  const img = t.previewImage ?? bg?.variants.standard ?? bg?.imageUrl;
  async function open() {
    const doc = await createFromTemplate(t.id);
    if (doc) router.push(`/nest-editor?doc=${doc.id}`);
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e0d5b8] bg-[#efe7cf]">
      <div className="aspect-[3/4] w-full bg-[#e9e0c8]">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element -- local curated art
          <img src={img} alt={t.name} className="size-full object-cover" loading="lazy" />
        ) : null}
      </div>
      <div className="space-y-1 p-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold">{t.name}</p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_STYLE[t.status]}`}>{t.status}</span>
          {!isOnboardingVisible(t.status) ? <span className="text-[10px] text-ink-soft">(hidden from onboarding)</span> : null}
        </div>
        <p className="text-xs text-ink-soft">{t.persona} · {bg?.name ?? t.backgroundId} · {t.objectPlacements.length} pieces</p>
        <div className="flex gap-2 pt-1">
          <button onClick={open} className="rounded-lg bg-[#d9913c] px-3 py-1.5 text-xs font-bold text-white">Open in editor</button>
        </div>
      </div>
    </div>
  );
}
