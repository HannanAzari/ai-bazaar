"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Link2, Sparkles } from "lucide-react";
import { GoldenNestStage } from "@/components/nest/golden-nest-stage";
import {
  GOLDEN_NEST_V2_ASSETS,
  GOLDEN_NEST_V2_ASSETS_BY_ID,
  GOLDEN_NEST_V2_INTERACTIONS,
  GOLDEN_NEST_V2_INTERACTIONS_BY_ID,
  GOLDEN_NEST_V2_TEMPLATE,
} from "@/lib/fixtures/golden-nest-v2";
import { GOLDEN_NEST_V2_POLICY } from "@/lib/fixtures/golden-nest-v2-policy";
import { NEST_CREATOR_PROFILES } from "@/lib/fixtures/nest-creator-profiles";
import { composeNest, NestCompositionError } from "@/lib/nest-composer";
import type { ComposeNestResult } from "@/lib/nest-composer-types";

// Internal Nest Composer demo (not onboarding, noindex). Pick one of three demo
// creator profiles, press "Compose Nest", and the deterministic Composer
// (lib/nest-composer.ts) returns a real ComposedNest rendered by the EXISTING
// Golden Nest V2 renderer (GoldenNestStage) — no second rendering system. The
// collapsible "Why this Nest?" panel exposes the decision trace.

type SafeResult = { ok: true; result: ComposeNestResult } | { ok: false; error: string };

function compose(profileId: string): SafeResult {
  const profile = NEST_CREATOR_PROFILES.find((p) => p.id === profileId)!;
  try {
    const result = composeNest({
      profile,
      templates: [GOLDEN_NEST_V2_TEMPLATE],
      assets: GOLDEN_NEST_V2_ASSETS,
      interactions: GOLDEN_NEST_V2_INTERACTIONS,
      policy: GOLDEN_NEST_V2_POLICY,
    });
    return { ok: true, result };
  } catch (e) {
    const error = e instanceof NestCompositionError ? e.message : String(e);
    return { ok: false, error };
  }
}

export function NestComposerExperience() {
  const [profileId, setProfileId] = useState<string>(NEST_CREATOR_PROFILES[0].id);
  const [composedId, setComposedId] = useState<string | null>(null);

  const profile = useMemo(
    () => NEST_CREATOR_PROFILES.find((p) => p.id === profileId)!,
    [profileId],
  );
  // Only compute once the user presses "Compose Nest" (the explicit action).
  const safe = useMemo(() => (composedId ? compose(composedId) : null), [composedId]);

  const ambienceName = (id: string): string =>
    GOLDEN_NEST_V2_TEMPLATE.ambiencePresets.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-terracotta">
          Nestudio · Internal
        </p>
        <h1 className="display text-xl leading-tight">Nest Composer</h1>
        <p className="mt-1 text-xs text-ink/55">
          Deterministic composition: a creator profile → a valid Golden Nest V2 manifest, rendered
          by the existing renderer. Same input always yields the same Nest.
        </p>
      </div>

      {/* Profile choices */}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Creator profile">
        {NEST_CREATOR_PROFILES.map((p) => {
          const active = p.id === profileId;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setProfileId(p.id)}
              className={`rounded-2xl border px-3 py-2 text-left text-xs font-bold transition ${
                active
                  ? "border-terracotta bg-terracotta/10 text-ink"
                  : "border-ink/15 text-ink/60 hover:border-ink/30"
              }`}
            >
              <span className="block">{p.displayName}</span>
              <span className="mt-0.5 block text-[10px] font-medium text-ink/45">
                {p.creatorTypes.join(" · ")}
              </span>
            </button>
          );
        })}
      </div>

      {/* Compose action */}
      <button
        type="button"
        onClick={() => setComposedId(profile.id)}
        className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2 text-sm font-bold text-parchment hover:bg-ink/85"
      >
        <Sparkles className="h-4 w-4" /> Compose Nest
      </button>

      {/* Result */}
      {safe ? (
        safe.ok ? (
          <Composed
            key={safe.result.nest.ownerId}
            result={safe.result}
            ambienceName={ambienceName(safe.result.nest.ambiencePresetId)}
          />
        ) : (
          <div className="rounded-2xl border border-terracotta/40 bg-terracotta/10 p-3 text-xs text-ink">
            <p className="font-bold">Composition failed</p>
            <p className="mt-1 text-ink/70">{safe.error}</p>
          </div>
        )
      ) : (
        <p className="text-xs text-ink/45">Choose a profile and press “Compose Nest”.</p>
      )}
    </div>
  );
}

function Composed({ result, ambienceName }: { result: ComposeNestResult; ambienceName: string }) {
  const { nest, decisions, warnings } = result;

  return (
    <div className="space-y-4">
      {/* Creator + ambience summary */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h2 className="display truncate text-lg leading-tight">{nest.ownerId}</h2>
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink/45">
            Ambience: {ambienceName} · {nest.slotAssignments.length} objects · {nest.accessLevel}
          </p>
        </div>
      </div>

      {/* The real ComposedNest, rendered by the existing Golden Nest V2 renderer. */}
      <GoldenNestStage
        template={GOLDEN_NEST_V2_TEMPLATE}
        assetsById={GOLDEN_NEST_V2_ASSETS_BY_ID}
        interactionsById={GOLDEN_NEST_V2_INTERACTIONS_BY_ID}
        composed={nest}
      />

      {/* Quick links (unconsumed content sources). */}
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink/45">
          Quick links
        </p>
        {nest.quickLinks.length ? (
          <ul className="flex flex-wrap gap-2">
            {nest.quickLinks.map((q) => (
              <li key={q.id}>
                <a
                  href={q.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1 text-xs font-bold text-ink/70 hover:border-ink/30"
                >
                  <Link2 className="h-3 w-3" /> {q.label}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink/45">No leftover links — every source bound to an object.</p>
        )}
      </div>

      {warnings.length ? (
        <div className="rounded-xl border border-amber-400/40 bg-amber-50/60 p-2.5 text-xs text-ink/75">
          <p className="font-bold">Warnings</p>
          <ul className="mt-1 list-disc pl-4">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Collapsible internal decision trace. */}
      <details className="group rounded-2xl border border-ink/10 bg-white/50">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-bold text-ink/70">
          <span>Why this Nest? — decision trace</span>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="overflow-x-auto px-3 pb-3">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink/45">
                <th className="py-1.5 pr-3 font-bold">Slot</th>
                <th className="py-1.5 pr-3 font-bold">Asset</th>
                <th className="py-1.5 pr-3 font-bold">Interaction</th>
                <th className="py-1.5 pr-3 font-bold">Content</th>
                <th className="py-1.5 pr-3 font-bold">Score</th>
                <th className="py-1.5 font-bold">Reasons</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d) => {
                const asset = d.assetId ? GOLDEN_NEST_V2_ASSETS_BY_ID[d.assetId] : undefined;
                const interaction = d.interactionId
                  ? GOLDEN_NEST_V2_INTERACTIONS_BY_ID[d.interactionId]
                  : undefined;
                const content = nest.slotAssignments.find((a) => a.slotId === d.slotId)?.content;
                return (
                  <tr key={d.slotId} className="border-b border-ink/5 align-top">
                    <td className="py-1.5 pr-3 font-mono text-[11px] text-ink/70">{d.slotId}</td>
                    <td className="py-1.5 pr-3 text-ink/80">{asset?.name ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-ink/60">{interaction?.name ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-ink/60">
                      {content ? `${content.title ?? content.contentType}` : "—"}
                    </td>
                    <td className="py-1.5 pr-3 font-mono text-ink/70">{d.score}</td>
                    <td className="py-1.5 text-ink/55">{d.reasons.join("; ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
