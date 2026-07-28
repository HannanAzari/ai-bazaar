"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { AuthPanel } from "@/components/nest/app-shell/auth-panel";
import { HouseExterior } from "@/components/nest/village/house-exterior";
import { isUsernameAvailable as serverUsernameAvailable } from "@/lib/nest/supabase-profile-repo";
import { normalizeUsername, validateUsername } from "@/lib/nest-profile-store";
import { hashSeed, houseStyleOptions, type House, type HouseStyleKey } from "@/lib/nest-house";
import { nestBackend } from "@/lib/nest-repo";
import { z } from "@/lib/nest-layers";

// ── M23B §1 — first-time onboarding ──────────────────────────────────────────
//
//   Choose identity  →  Choose house  →  own Profile
//
// Two steps, nothing else. Bio, links and avatar are deliberately NOT asked for here —
// a new user should arrive at "this is me and this is my house", not at a form.
//
// Step 1's values survive going back from step 2 (they live in this component's state,
// not in the step that renders them), and the username's availability is checked against
// the SERVER, because a handle that is free in your browser is not necessarily free.

type Step = "identity" | "house";

export function OnboardingClient() {
  const router = useRouter();
  const { signedIn, loading, profile, onboardingStep, needsOnboarding, saveIdentity, saveHouse } = useNestIdentity();

  // Preserved across back/forward between steps.
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [step, setStep] = useState<Step>("identity");
  const [seeded, setSeeded] = useState(false);

  // Resume where the creator left off, and seed the fields from whatever they already have.
  useEffect(() => {
    if (loading || seeded) return;
    if (profile) {
      setDisplayName((v) => v || profile.displayName || "");
      setUsername((v) => v || profile.username || "");
    }
    if (onboardingStep === "house") setStep("house");
    setSeeded(true);
  }, [loading, seeded, profile, onboardingStep]);

  // A creator who is already fully configured must never be trapped in onboarding.
  useEffect(() => {
    if (loading || !signedIn) return;
    if (!needsOnboarding) router.replace("/profile");
  }, [loading, signedIn, needsOnboarding, router]);

  if (loading) return <Centered><Loader2 className="size-5 animate-spin text-ink/40" /></Centered>;

  if (!signedIn) {
    return (
      <Centered>
        <div className="w-full rounded-3xl border border-timber/15 bg-white p-5 shadow-soft">
          <h1 className="display text-2xl">Make your Nest</h1>
          <p className="mb-4 mt-1 text-sm text-ink/55">Create an account and we&rsquo;ll set up your house.</p>
          <AuthPanel />
        </div>
      </Centered>
    );
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[460px] flex-col px-5 pb-6 pt-5">
      <StepDots step={step} />
      {step === "identity" ? (
        <IdentityStep
          displayName={displayName}
          username={username}
          onDisplayName={setDisplayName}
          onUsername={setUsername}
          onContinue={async () => {
            const r = await saveIdentity(displayName, username);
            if (r.ok) setStep("house");
            return r;
          }}
        />
      ) : (
        <HouseStep
          onBack={() => setStep("identity")}
          onContinue={async (key) => {
            const r = await saveHouse(key);
            if (r.ok) router.replace("/profile");
            return r;
          }}
        />
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid min-h-[100dvh] w-full max-w-[420px] place-items-center px-5">{children}</div>
  );
}

function StepDots({ step }: { step: Step }) {
  return (
    <div className="mb-5 flex items-center gap-2" role="status" aria-label={step === "identity" ? "Step 1 of 2" : "Step 2 of 2"}>
      <span className="h-1 w-8 rounded-full bg-terracotta" />
      <span className={`h-1 w-8 rounded-full ${step === "house" ? "bg-terracotta" : "bg-ink/12"}`} />
    </div>
  );
}

// ── Step 1 — identity ────────────────────────────────────────────────────────

type SaveResult = { ok: true } | { ok: false; error: string };
type Availability = "idle" | "checking" | "free" | "taken" | "invalid" | "unknown";

function IdentityStep({
  displayName,
  username,
  onDisplayName,
  onUsername,
  onContinue,
}: {
  displayName: string;
  username: string;
  onDisplayName: (v: string) => void;
  onUsername: (v: string) => void;
  onContinue: () => Promise<SaveResult>;
}) {
  const { ownerId } = useNestIdentity();
  const [availability, setAvailability] = useState<Availability>("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const normalized = normalizeUsername(username);
  const formatError = username.trim() ? validateUsername(username) : null;

  // Debounced server availability check. `seq` discards the answer to a query the
  // creator has already typed past, so a slow response can't overwrite a newer one.
  const seq = useRef(0);
  useEffect(() => {
    if (!username.trim()) { setAvailability("idle"); return; }
    if (formatError) { setAvailability("invalid"); return; }
    if (nestBackend() !== "supabase") { setAvailability("free"); return; }
    setAvailability("checking");
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const free = await serverUsernameAvailable(normalized, ownerId);
        if (mine === seq.current) setAvailability(free ? "free" : "taken");
      } catch {
        // Don't claim "free" when we could not ask — the Continue button stays enabled
        // and the DB's unique index gets the final say on submit.
        if (mine === seq.current) setAvailability("unknown");
      }
    }, 350);
    return () => clearTimeout(t);
  }, [username, normalized, formatError, ownerId]);

  const canContinue =
    !!displayName.trim() && !!normalized && !formatError && availability !== "taken" && availability !== "checking" && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await onContinue();
    setBusy(false);
    if (!r.ok) setError(r.error);
  };

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="display text-3xl leading-tight">Who are you?</h1>
      <p className="mb-6 mt-1.5 text-sm text-ink/55">Your name and the handle your Nest lives at.</p>

      <label className="block">
        <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-ink/45">Display name</span>
        <input
          value={displayName}
          onChange={(e) => onDisplayName(e.target.value)}
          placeholder="Your name"
          aria-label="Display name"
          autoComplete="name"
          maxLength={80}
          style={{ fontSize: 16 }}
          className="min-h-[52px] w-full rounded-2xl border border-timber/20 bg-white px-4 outline-none focus:border-terracotta/60"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-ink/45">Username</span>
        <span className="flex items-center rounded-2xl border border-timber/20 bg-white px-4 focus-within:border-terracotta/60">
          <span className="text-base font-bold text-ink/35">@</span>
          <input
            value={username}
            onChange={(e) => onUsername(e.target.value)}
            placeholder="yourname"
            aria-label="Username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={20}
            style={{ fontSize: 16 }}
            className="min-h-[52px] w-full bg-transparent pl-1 outline-none"
          />
          <AvailabilityMark state={availability} />
        </span>
      </label>

      <UsernameHint state={availability} formatError={formatError} normalized={normalized} raw={username} />

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error}</p>
      ) : null}

      <div className="flex-1" />

      <button
        onClick={submit}
        disabled={!canContinue}
        className="mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-terracotta text-[15px] font-black text-parchment transition disabled:opacity-40 active:scale-[0.99]"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        Continue <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

function AvailabilityMark({ state }: { state: Availability }) {
  if (state === "checking") return <Loader2 className="size-4 shrink-0 animate-spin text-ink/30" />;
  if (state === "free") return <Check className="size-4 shrink-0 text-[#4d7358]" />;
  return null;
}

function UsernameHint({
  state,
  formatError,
  normalized,
  raw,
}: {
  state: Availability;
  formatError: string | null;
  normalized: string;
  raw: string;
}) {
  // One line, one message, always specific about what to do next.
  if (formatError) return <Hint tone="bad">{formatError}</Hint>;
  if (state === "taken") return <Hint tone="bad">@{normalized} is already taken. Try another.</Hint>;
  if (state === "unknown") return <Hint tone="warn">We couldn&rsquo;t check that handle right now — you can still continue.</Hint>;
  if (state === "free") return <Hint tone="good">@{normalized} is available.</Hint>;
  // Normalisation is visible rather than surprising: typing "Ada Lovelace" shows
  // @ada_lovelace before you commit to it.
  if (raw.trim() && normalized !== raw.trim().toLowerCase()) {
    return <Hint tone="muted">Your handle will be @{normalized}.</Hint>;
  }
  return <Hint tone="muted">Lowercase letters, numbers and underscores. 3–20 characters.</Hint>;
}

function Hint({ tone, children }: { tone: "good" | "bad" | "warn" | "muted"; children: React.ReactNode }) {
  const cls =
    tone === "good" ? "text-[#4d7358]" : tone === "bad" ? "text-terracotta" : tone === "warn" ? "text-[#8a6a2f]" : "text-ink/45";
  return <p className={`mt-1.5 text-[12px] font-medium ${cls}`}>{children}</p>;
}

// ── Step 2 — house ───────────────────────────────────────────────────────────

/** A throwaway House just to render a style's exterior. Deterministic per style. */
function previewHouse(key: string, label: string): House {
  return {
    id: `preview-${key}`,
    name: label,
    style: houseStyleOptions().find((o) => o.key === key)!.style,
    seed: hashSeed(`house-preview:${key}`),
    isReal: false,
    online: false,
  };
}

function HouseStep({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: (key: HouseStyleKey) => Promise<SaveResult>;
}) {
  const options = useMemo(() => houseStyleOptions(), []);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const selected = options[index];

  // Swipe = native horizontal scroll with snap points. We read the scroll position back
  // rather than installing pointer handlers, so momentum, trackpads, and a keyboard all
  // work for free and nothing fights the browser.
  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    if (!card) return;
    const stride = card.offsetWidth + 12; // card + gap-3
    const next = Math.round(el.scrollLeft / stride);
    setIndex((cur) => (next !== cur && next >= 0 && next < options.length ? next : cur));
  }, [options.length]);

  // Tap a card → scroll it into view (keeps tap and swipe on the same selection model).
  const select = (i: number) => {
    setIndex(i);
    const el = trackRef.current;
    const card = el?.children[i] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await onContinue(selected.key);
    setBusy(false);
    if (!r.ok) setError(r.error);
  };

  return (
    <div className="flex flex-1 flex-col">
      <button onClick={onBack} className="-ml-1 mb-3 inline-flex min-h-[36px] items-center gap-1 self-start text-[13px] font-bold text-ink/50">
        <ArrowLeft className="size-4" /> Back
      </button>

      <h1 className="display text-3xl leading-tight">Pick your house</h1>
      <p className="mb-5 mt-1.5 text-sm text-ink/55">This is how visitors arrive at your Nests. You get one.</p>

      {/* full-bleed track so a card can sit centred on a 375px screen */}
      <div
        ref={trackRef}
        onScroll={onScroll}
        role="radiogroup"
        aria-label="House style"
        className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {options.map((o, i) => {
          const active = i === index;
          return (
            <button
              key={o.key}
              role="radio"
              aria-checked={active}
              onClick={() => select(i)}
              className={`relative flex w-[70vw] max-w-[280px] shrink-0 snap-center flex-col overflow-hidden rounded-3xl border-2 bg-white text-left transition ${
                active ? "border-terracotta shadow-lift" : "border-timber/15 opacity-70"
              }`}
            >
              <span
                className="flex aspect-[4/5] items-end justify-center px-5 pb-4"
                style={{ background: `linear-gradient(#dfe9ee, ${o.style.ground})` }}
              >
                <HouseExterior house={previewHouse(o.key, o.style.label)} className="w-full" />
              </span>
              <span className="flex items-start justify-between gap-2 p-3.5">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-black text-ink">{o.style.label}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-ink/50">{o.blurb}</span>
                </span>
                {active ? (
                  <span className={`grid size-6 shrink-0 place-items-center rounded-full bg-terracotta text-parchment ${z.hotspots}`}>
                    <Check className="size-3.5" />
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      {/* position dots — these page the CAROUSEL, not Nests (see D-06) */}
      <div className="mt-3 flex justify-center gap-1.5">
        {options.map((o, i) => (
          <span key={o.key} className={`h-1 rounded-full transition-all ${i === index ? "w-5 bg-terracotta" : "w-1.5 bg-ink/15"}`} />
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error}</p>
      ) : null}

      <div className="flex-1" />

      <button
        onClick={submit}
        disabled={busy}
        className="mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-terracotta text-[15px] font-black text-parchment transition disabled:opacity-40 active:scale-[0.99]"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        Move in <ArrowRight className="size-4" />
      </button>
    </div>
  );
}
