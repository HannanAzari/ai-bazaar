"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Palette, Sparkles, Wand2 } from "lucide-react";
import { getBackgrounds, getTemplates, hydrateLibrary, onProductionChanged } from "@/lib/nest-production-library";
import { createFromBackground, createFromTemplate } from "@/lib/nest-repo";
import { setDocOwner } from "@/lib/nest-document-store";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import type { ProductionBackground, ProductionTemplate } from "@/lib/nest-production-types";
import { BOTTOM_NAV_CLEARANCE } from "@/lib/nest-layers";

// Phase 2 — the Create tab, the single creation entry point. Quick Start (a ready
// template) or Build My Own (a chosen room) → creates a NestDocument → opens the one
// editor. Publishing then returns the creator Home. Onboarding is no longer a
// disconnected screen: /design/nest-onboarding redirects here.

type Step = "entry" | "quick" | "build";

export function CreateClient() {
  const router = useRouter();
  const { ownerId } = useNestIdentity();
  const [step, setStep] = useState<Step>("entry");
  const [templates, setTemplates] = useState<ProductionTemplate[]>([]);
  const [backgrounds, setBackgrounds] = useState<ProductionBackground[]>([]);
  const [selTpl, setSelTpl] = useState<string>();
  const [selBg, setSelBg] = useState<string>();
  const [busy, setBusy] = useState(false);
  // M21 (N-02) — the AI asset path is founder-only server-side (requireFounder). Showing it
  // to everyone meant a normal user picked it, wrote a description, then hit a 403. Ask the
  // server who's asking and only offer the card when it will actually work.
  const [isFounder, setIsFounder] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/whoami").then((r) => r.json())
      .then((d) => { if (alive) setIsFounder(Boolean(d?.authenticated && d?.isFounder)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const load = () => {
      setTemplates(getTemplates({ onlyVisible: true }));
      setBackgrounds(getBackgrounds({ onlyVisible: true }));
    };
    load();
    const off = onProductionChanged(load);
    void hydrateLibrary();
    return off;
  }, []);

  const template = templates.find((t) => t.id === selTpl);
  const background = backgrounds.find((b) => b.id === selBg);

  async function startTemplate(id: string) {
    setBusy(true);
    const doc = await createFromTemplate(id);
    if (doc) { if (ownerId) setDocOwner(doc.id, ownerId); router.push(`/nest-editor?document=${doc.id}`); }
    else setBusy(false);
  }
  async function startBackground(id: string, name?: string) {
    setBusy(true);
    const doc = await createFromBackground(id, name ? `My ${name}` : "My Nest");
    if (ownerId) setDocOwner(doc.id, ownerId);
    router.push(`/nest-editor?document=${doc.id}`);
  }

  return (
    <div className="pt-2">
      {step !== "entry" ? (
        <button
          onClick={() => { setStep("entry"); setSelTpl(undefined); setSelBg(undefined); }}
          className="mb-3 flex items-center gap-1 text-sm font-bold text-ink/50 hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Back
        </button>
      ) : null}

      {step === "entry" ? <Entry onQuick={() => setStep("quick")} onBuild={() => setStep("build")} onAi={isFounder ? () => router.push("/creator-studio") : undefined} /> : null}

      {/* M24 §5 — Quick Start and Build My Own are ONE interaction, not two look-alike
          implementations. Both render <SelectionStep>, so the carousel behaviour, the
          selected state and the sticky action bar can never drift apart again. */}
      {step === "quick" ? (
        <SelectionStep
          title="Quick Start"
          subtitle="Pick a ready-made Nest. You can change everything later."
          emptyLabel="No templates are published yet."
          hint="Tap a template to choose it. No sign-up needed to start."
          isEmpty={templates.length === 0}
          selectedLabel={template ? `${template.name} · ${template.persona}` : null}
          actionLabel={busy ? "Opening…" : "Start building →"}
          onAction={template ? () => startTemplate(template.id) : undefined}
          busy={busy}
        >
          {templates.map((t) => (
            <TemplateCard key={t.id} t={t} selected={t.id === selTpl} onSelect={() => setSelTpl(t.id)} />
          ))}
        </SelectionStep>
      ) : null}

      {step === "build" ? (
        <SelectionStep
          title="Build My Own"
          subtitle="Choose a room to start from, then design every detail."
          emptyLabel="No rooms are published yet."
          hint="Tap a room to choose it. No sign-up needed to start."
          isEmpty={backgrounds.length === 0}
          selectedLabel={background ? `${background.name} · ${background.style}` : null}
          actionLabel={busy ? "Opening…" : "Start building →"}
          onAction={background ? () => startBackground(background.id, background.name) : undefined}
          busy={busy}
        >
          {backgrounds.map((b) => (
            <BackgroundCard key={b.id} b={b} selected={b.id === selBg} onSelect={() => setSelBg(b.id)} />
          ))}
        </SelectionStep>
      ) : null}
    </div>
  );
}

const btnPrimary = "block w-full rounded-xl bg-terracotta px-4 py-3 text-center text-sm font-bold text-parchment hover:brightness-95 disabled:opacity-60";
const btnGhost = "block w-full rounded-xl px-4 py-2 text-center text-sm font-bold text-ink/50 hover:text-ink";

function Entry({ onQuick, onBuild, onAi }: { onQuick: () => void; onBuild: () => void; onAi?: () => void }) {
  return (
    <section className="space-y-6 pt-2">
      <div className="text-center">
        <p className="eyebrow text-terracotta">Nestudio</p>
        <h1 className="display mt-1 text-4xl">Create your Nest</h1>
        <p className="mt-2 text-sm text-ink/55">Step into a space that feels like you. No account needed to start.</p>
      </div>
      <button onClick={onQuick} className="block w-full rounded-3xl border border-timber/15 bg-gradient-to-br from-[#f6e7c6] to-[#ecd9ad] p-5 text-left shadow-soft transition hover:brightness-[0.98]">
        <div className="flex items-center gap-2"><Sparkles className="size-5 text-terracotta" /><span className="display text-2xl">Quick Start</span></div>
        <p className="mt-1 text-sm text-ink/55">Create your Nest in under 2 minutes.</p>
        <span className="mt-3 inline-block rounded-full bg-terracotta px-3 py-1 text-xs font-bold text-parchment">Recommended</span>
      </button>
      {onAi ? (
      <button onClick={onAi} className="block w-full rounded-3xl border border-timber/15 bg-gradient-to-br from-[#efe3f6] to-[#e5d3ec] p-5 text-left shadow-soft transition hover:brightness-[0.98]">
        <div className="flex items-center gap-2"><Wand2 className="size-5 text-[#7a4fa0]" /><span className="display text-2xl">Turn your object into a Nestudio asset</span></div>
        <p className="mt-1 text-sm text-ink/55">Photograph a real belonging and place it in your Nest.</p>
      </button>
      ) : null}
      <button onClick={onBuild} className="block w-full rounded-3xl border border-timber/15 bg-white p-5 text-left shadow-soft transition hover:brightness-[0.98]">
        <div className="flex items-center gap-2"><Palette className="size-5 text-teal" /><span className="display text-2xl">Build My Own</span></div>
        <p className="mt-1 text-sm text-ink/55">Design every detail yourself.</p>
      </button>
    </section>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="display text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-ink/55">{subtitle}</p>
    </div>
  );
}

/**
 * M24 §5 — one selection step: heading, horizontal carousel, and a sticky action bar.
 *
 * The action used to sit in a card BELOW the carousel, so on a phone you selected a room
 * and then had to scroll to find the button. The bar is now pinned above the bottom nav
 * and the Safari toolbar, and it names what you picked — so the choice and the
 * confirmation are visible together, without scrolling.
 */
function SelectionStep({
  title,
  subtitle,
  hint,
  emptyLabel,
  isEmpty,
  selectedLabel,
  actionLabel,
  onAction,
  busy,
  children,
}: {
  title: string;
  subtitle: string;
  hint: string;
  emptyLabel: string;
  isEmpty: boolean;
  selectedLabel: string | null;
  actionLabel: string;
  onAction?: () => void;
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <Header title={title} subtitle={subtitle} />
      <SwipeRow>
        {children}
        {isEmpty ? <EmptyNote label={emptyLabel} /> : null}
      </SwipeRow>

      {/* M24B §8 — the action lives with the selection, in normal flow.
          A sticky bar overlaid the carousel and clipped the cards behind it; this keeps
          every card fully visible and still needs no scrolling, because the row + this
          block fit one screen together. */}
      <div className="pb-2" style={{ paddingBottom: BOTTOM_NAV_CLEARANCE }}>
        {selectedLabel ? (
          <div className="rounded-2xl border border-terracotta/30 bg-white p-3 shadow-soft">
            <p className="mb-2 truncate text-[13px] font-black text-ink">{selectedLabel}</p>
            <button onClick={onAction} disabled={busy} className={btnPrimary}>{actionLabel}</button>
          </div>
        ) : (
          <p className="text-center text-xs text-ink/50">{hint}</p>
        )}
      </div>
    </section>
  );
}

function SwipeRow({ children }: { children: React.ReactNode }) {
    // M24B §8 — `overflow-y-visible` matters: a horizontal scroller with `overflow-x:auto`
  // makes the CROSS axis `auto` too unless it is explicitly visible, which clipped the
  // cards' shadows and ring. `py` gives the selected card's ring room to breathe.
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-visible px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}

function TemplateCard({ t, selected, onSelect }: { t: ProductionTemplate; selected: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className={`w-[220px] shrink-0 snap-center rounded-2xl border bg-white text-left transition ${selected ? "border-terracotta ring-2 ring-terracotta" : "border-timber/15"}`}>
      <PreviewImage src={t.previewImage} alt={t.name} />
      <div className="p-3">
        <p className="text-sm font-bold">{t.name}</p>
        <p className="text-xs text-ink/50">{t.persona} · {t.objectPlacements.length} pieces</p>
        <TagRow tags={t.tags} featured={t.status === "featured"} />
      </div>
    </button>
  );
}

function BackgroundCard({ b, selected, onSelect }: { b: ProductionBackground; selected: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className={`w-[220px] shrink-0 snap-center rounded-2xl border bg-white text-left transition ${selected ? "border-terracotta ring-2 ring-terracotta" : "border-timber/15"}`}>
      <PreviewImage src={b.variants.standard ?? b.imageUrl} alt={b.name} />
      <div className="p-3">
        <p className="text-sm font-bold">{b.name}</p>
        <p className="text-xs text-ink/50">{b.style}</p>
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
      {featured ? <span className="rounded-full bg-terracotta px-1.5 py-0.5 text-[10px] font-bold text-parchment">★ Featured</span> : null}
      {tags.slice(0, 3).map((t) => (
        <span key={t} className="rounded-full bg-[#efe7cf] px-1.5 py-0.5 text-[10px] font-bold text-ink/50">{t}</span>
      ))}
    </div>
  );
}

function EmptyNote({ label }: { label: string }) {
  return <div className="w-[220px] shrink-0 rounded-2xl border border-dashed border-timber/30 p-6 text-center text-xs text-ink/50">{label}</div>;
}
