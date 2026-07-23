"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getActiveAvatar } from "@/lib/avatar-factory/avatar-repo";
import { VISUAL_DNA_VERSION } from "@/lib/visual-dna";

// Founder-only Character Calibration Lab: shows the latest Avatar + Asset + Empty Nest
// together to answer the ONE question — "Do these feel like one world?" — before the new
// Avatar DNA is opened to users. Founder-gated via /api/auth/whoami (server truth).

const VERDICT_KEY = "nestudio:visual-dna-verdict:v1";

function latestLocalImage(key: string): string | null {
  try {
    const lib = JSON.parse(localStorage.getItem(key) || "[]") as { finalDataUrl?: string; imageUrl?: string }[];
    const first = lib[0];
    return first?.imageUrl || first?.finalDataUrl || null;
  } catch { return null; }
}

export function CalibrationClient() {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "denied" | "ready">("loading");
  const [asset, setAsset] = useState<string | null>(null);
  const [nest, setNest] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<"yes" | "no" | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/whoami").then((r) => r.json()).then((d) => {
      if (!alive) return;
      if (!d?.authenticated || !d?.isFounder) { setState("denied"); return; }
      setState("ready");
      setAsset(latestLocalImage("nestudio:founder-library:v1"));
      setNest(latestLocalImage("nestudio:founder-nest-library:v1"));
      void getActiveAvatar().then((a) => { if (alive) setAvatar(a?.publicProfileUrl ?? a?.editorAssetUrl ?? null); });
      try { setVerdict((localStorage.getItem(VERDICT_KEY) as "yes" | "no") || null); } catch {}
    }).catch(() => setState("denied"));
    return () => { alive = false; };
  }, []);

  const record = useCallback((v: "yes" | "no") => { setVerdict(v); try { localStorage.setItem(VERDICT_KEY, v); } catch {} }, []);

  if (state === "loading") return <div className="mx-auto max-w-md p-8 text-center text-sm text-neutral-500">Loading…</div>;
  if (state === "denied") return <div className="mx-auto max-w-md p-8 text-center text-sm text-neutral-500">Founder access required.</div>;

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-white px-4 text-neutral-900" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))", paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>
      <header className="mb-3 flex items-center gap-2">
        <button onClick={() => router.push("/profile")} aria-label="Back" className="flex size-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"><ArrowLeft size={20} /></button>
        <div>
          <h1 className="text-lg font-black tracking-tight">Character Calibration</h1>
          <p className="text-[11px] text-neutral-500">One world across Avatar · Asset · Empty Nest · DNA {VISUAL_DNA_VERSION}</p>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Panel label="Avatar" img={avatar} href="/profile/avatar" cta="Generate" />
        <Panel label="Asset" img={asset} href="/asset-factory" cta="Generate" />
        <Panel label="Empty Nest" img={nest} href="/nest-factory" cta="Generate" />
      </div>

      {avatar && nest && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold text-neutral-500">In-room (avatar on the Nest)</p>
          <div className="relative w-full overflow-hidden rounded-2xl border border-neutral-200" style={{ aspectRatio: "3 / 4" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}<img src={nest} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {/* eslint-disable-next-line @next/next/no-img-element */}<img src={avatar} alt="" className="absolute bottom-0 left-1/2 h-[70%] -translate-x-1/2 object-contain" />
          </div>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-neutral-200 p-3">
        <p className="text-center text-sm font-bold">Do these feel like one world?</p>
        <div className="mt-2 flex gap-2">
          <button onClick={() => record("yes")} className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${verdict === "yes" ? "bg-emerald-600 text-white" : "border border-neutral-200"}`}>Yes</button>
          <button onClick={() => record("no")} className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${verdict === "no" ? "bg-neutral-800 text-white" : "border border-neutral-200"}`}>No</button>
        </div>
        <p className="mt-2 text-center text-[11px] text-neutral-500">
          {verdict === "yes" ? "Approved — set AVATAR_PUBLIC_ENABLED=1 to open Avatar Studio to users." : verdict === "no" ? "Not yet — iterate the DNA before opening avatars to users." : "Generate one of each, then judge them together."}
        </p>
      </div>
    </div>
  );
}

function Panel({ label, img, href, cta }: { label: string; img: string | null; href: string; cta: string }) {
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-400">{label}</p>
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
        {img
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={img} alt={label} className="h-full w-full object-contain" />
          : <Link href={href} className="px-2 text-center text-[11px] font-bold text-terracotta">{cta} →</Link>}
      </div>
    </div>
  );
}
