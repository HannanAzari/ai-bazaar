"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Palette } from "lucide-react";
import { getBackgrounds, getTemplates, hydrateLibrary, onProductionChanged } from "@/lib/nest-production-library";
import { createFromBackground, createFromTemplate } from "@/lib/nest-repo";
import type { ProductionBackground, ProductionTemplate } from "@/lib/nest-production-types";

type Step = "entry" | "quick" | "build";

export function NestOnboardingClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("entry");
  const [templates, setTemplates] = useState<ProductionTemplate[]>([]);
  const [backgrounds, setBackgrounds] = useState<ProductionBackground[]>([]);
  const [selTpl, setSelTpl] = useState<string>();
  const [selBg, setSelBg] = useState<string>();

  useEffect(() => {
    const load = () => {
      setTemplates(getTemplates({ onlyVisible: true }));
      setBackgrounds(getBackgrounds({ onlyVisible: true }));
    };
    load();
    const off = onProductionChanged(load);
    void hydrateLibrary(); // M12.1: pull the DB library when backend=supabase
    return off;
  }, []);

  const template = templates.find((t) => t.id === selTpl);
  const background = backgrounds.find((b) => b.id === selBg);

  // Choosing a template/background creates a real Nest document and opens the editor.
  async function startTemplate(id: string) {
    const doc = await createFromTemplate(id);
    if (doc) router.push(`/nest-editor?document=${doc.id}`);
  }
  async function startBackground(id: string, name?: string) {
    const doc = await createFromBackground(id, name ? `My ${name}` : "My Nest");
    router.push(`/nest-editor?document=${doc.id}`);
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[460px] px-4 pb-16 pt-6">
      {step !== "entry" ? (
        <button
          onClick={() => { setStep("entry"); setSelTpl(undefined); setSelBg(undefined); }}
          className="mb-3 flex items-center gap-1 text-sm font-bold text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Back
        </button>
      ) : null}

      {step === "entry" ? (
        <Entry onQuick={() => setStep("quick")} onBuild={() => setStep("build")} />
      ) : null}

      {step === "quick" ? (
        <section className="space-y-4">
          <Header title="Quick Start" subtitle="Pick a ready-made Nest. You can change everything later." />
          <SwipeRow>
            {templates.map((t) => (
              <TemplateCard key={t.id} t={t} selected={t.id === selTpl} onSelect={() => setSelTpl(t.id)} />
            ))}
            {templates.length === 0 ? <EmptyNote label="No templates are published yet." /> : null}
          </SwipeRow>
          {template ? (
            <div className="space-y-2 rounded-2xl border border-[#e0d5b8] bg-[#efe7cf] p-4">
              <p className="text-sm font-bold">{template.name} · <span className="text-ink-soft">{template.persona}</span></p>
              <div className="grid gap-2">
                <button onClick={() => startTemplate(template.id)} className={btnPrimary}>Use this template →</button>
                <button onClick={() => setSelTpl(undefined)} className={btnGhost}>Change Template</button>
              </div>
            </div>
          ) : (
            <p className="px-1 text-xs text-ink-soft">Tap a template to choose it. No sign-up needed.</p>
          )}
        </section>
      ) : null}

      {step === "build" ? (
        <section className="space-y-4">
          <Header title="Build My Own" subtitle="Choose a room to start from, then design every detail." />
          <SwipeRow>
            {backgrounds.map((b) => (
              <BackgroundCard key={b.id} b={b} selected={b.id === selBg} onSelect={() => setSelBg(b.id)} />
            ))}
            {backgrounds.length === 0 ? <EmptyNote label="No backgrounds are published yet." /> : null}
          </SwipeRow>
          {background ? (
            <div className="space-y-2 rounded-2xl border border-[#e0d5b8] bg-[#efe7cf] p-4">
              <p className="text-sm font-bold">{background.name} · <span className="text-ink-soft">{background.style}</span></p>
              <button onClick={() => startBackground(background.id, background.name)} className={btnPrimary}>Start With This Room →</button>
            </div>
          ) : (
            <p className="px-1 text-xs text-ink-soft">Tap a room to choose it. No sign-up needed.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}

const btnPrimary = "block w-full rounded-xl bg-[#d9913c] px-4 py-3 text-center text-sm font-bold text-white hover:brightness-95";
const btnGhost = "block w-full rounded-xl px-4 py-2 text-center text-sm font-bold text-ink-soft hover:text-ink";

function Entry({ onQuick, onBuild }: { onQuick: () => void; onBuild: () => void }) {
  return (
    <section className="space-y-6 pt-4">
      <div className="text-center">
        <p className="eyebrow text-terracotta">Nestudio</p>
        <h1 className="display mt-1 text-4xl">Create your Nest</h1>
        <p className="mt-2 text-sm text-ink-soft">Step into a space that feels like you. No account needed to start.</p>
      </div>
      <button onClick={onQuick} className="block w-full rounded-3xl border border-[#e0d5b8] bg-gradient-to-br from-[#f6e7c6] to-[#ecd9ad] p-5 text-left shadow-sm transition hover:brightness-[0.98]">
        <div className="flex items-center gap-2"><Sparkles className="size-5 text-[#d9913c]" /><span className="display text-2xl">Quick Start</span></div>
        <p className="mt-1 text-sm text-ink-soft">Create your Nest in under 2 minutes.</p>
        <span className="mt-3 inline-block rounded-full bg-[#d9913c] px-3 py-1 text-xs font-bold text-white">Recommended</span>
      </button>
      <button onClick={onBuild} className="block w-full rounded-3xl border border-[#e0d5b8] bg-[#efe7cf] p-5 text-left shadow-sm transition hover:brightness-[0.98]">
        <div className="flex items-center gap-2"><Palette className="size-5 text-[#4d7358]" /><span className="display text-2xl">Build My Own</span></div>
        <p className="mt-1 text-sm text-ink-soft">Design every detail yourself.</p>
      </button>
    </section>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="display text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
    </div>
  );
}

function SwipeRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
      {children}
    </div>
  );
}

function TemplateCard({ t, selected, onSelect }: { t: ProductionTemplate; selected: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className={`w-[220px] shrink-0 snap-center overflow-hidden rounded-2xl border bg-white text-left transition ${selected ? "border-[#d9913c] ring-2 ring-[#d9913c]" : "border-[#e0d5b8]"}`}>
      <PreviewImage src={t.previewImage} alt={t.name} />
      <div className="p-3">
        <p className="text-sm font-bold">{t.name}</p>
        <p className="text-xs text-ink-soft">{t.persona} · {t.objectPlacements.length} pieces</p>
        <TagRow tags={t.tags} featured={t.status === "featured"} />
      </div>
    </button>
  );
}

function BackgroundCard({ b, selected, onSelect }: { b: ProductionBackground; selected: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className={`w-[220px] shrink-0 snap-center overflow-hidden rounded-2xl border bg-white text-left transition ${selected ? "border-[#d9913c] ring-2 ring-[#d9913c]" : "border-[#e0d5b8]"}`}>
      <PreviewImage src={b.variants.standard ?? b.imageUrl} alt={b.name} />
      <div className="p-3">
        <p className="text-sm font-bold">{b.name}</p>
        <p className="text-xs text-ink-soft">{b.style}</p>
        <TagRow tags={b.tags} featured={b.status === "featured"} />
      </div>
    </button>
  );
}

function PreviewImage({ src, alt }: { src?: string; alt: string }) {
  return (
    <div className="aspect-[3/4] w-full bg-[#e9e0c8]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- local curated art; next/image adds no value here
        <img src={src} alt={alt} className="size-full object-cover" loading="lazy" />
      ) : null}
    </div>
  );
}

function TagRow({ tags, featured }: { tags: string[]; featured?: boolean }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {featured ? <span className="rounded-full bg-[#d9913c] px-1.5 py-0.5 text-[10px] font-bold text-white">★ Featured</span> : null}
      {tags.slice(0, 3).map((t) => (
        <span key={t} className="rounded-full bg-[#efe7cf] px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">{t}</span>
      ))}
    </div>
  );
}

function EmptyNote({ label }: { label: string }) {
  return <div className="w-[220px] shrink-0 rounded-2xl border border-dashed border-[#c9b98a] p-6 text-center text-xs text-ink-soft">{label}</div>;
}
