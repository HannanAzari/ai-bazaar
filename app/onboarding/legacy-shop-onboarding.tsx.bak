"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Instagram, Loader2, Sparkles, WandSparkles, Youtube } from "lucide-react";
import { useSession } from "@/components/providers/auth-provider";
import { useDemo } from "@/components/providers/demo-provider";
import { Button } from "@/components/ui/button";
import { bazaars } from "@/lib/data";
import { generateCreatorRoom } from "@/lib/creator-analyzer";
import { claimShopInSupabase } from "@/lib/shop-claim";
import { isProductionBackend } from "@/lib/runtime-mode";
import { persistHouse } from "@/lib/house-store";
import { houseFromRoom } from "@/lib/house";
import { getRepositories } from "@/lib/repos";
import { trackEvent } from "@/lib/events";
import { friendlyError } from "@/lib/errors";
import { LIMITS, clampText } from "@/lib/validation";

// Onboarding V1 — the fastest path from first login to a furnished room. Reuses
// the V3 creator-analyzer + AI Room Designer (no second onboarding system). One
// screen → generate profile + Auto Build + first Nest → land in the room.
const ONBOARDED_KEY = "ai-bazaar-onboarded";

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useSession();
  const { ownedShop, claimShop } = useDemo();
  const [craft, setCraft] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [youtube, setYoutube] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Must be signed in; if already onboarded with a Nest, go to the studio.
  useEffect(() => {
    if (!user) router.replace("/auth/login");
  }, [user, router]);

  const build = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setError("");
    setBusy(true);
    try {
      // 1. Generate a creator profile from the answers.
      const bioParts = [craft.trim()].filter(Boolean);
      await getRepositories().profiles.update(user.id, {
        displayName: user.name,
        bio: bioParts.join(" ") || undefined,
      }).catch(() => undefined);

      // 2. Claim the first Nest. Production inserts a real `shops` row (Supabase);
      // demo uses DemoProvider's localStorage claim (unchanged).
      const shop = isProductionBackend()
        ? await claimShopInSupabase({ displayName: user.name })
        : ownedShop ?? claimShop(bazaars[0].id, 1);
      if (!shop) throw new Error("Could not create your Nest. Try again.");

      // 3. Run Creator Auto Build and persist the generated room.
      const built = generateCreatorRoom(
        { instagramUrl: instagram, tiktokUrl: tiktok, youtubeUrl: youtube, websiteUrl: website, bio: craft },
        shop.address,
      );
      await persistHouse(houseFromRoom(built.result.room));

      trackEvent("creator_profile_analyzed", { shopId: shop.id });
      trackEvent("creator_room_generated", { shopId: shop.id });
      trackEvent("creator_room_applied", { shopId: shop.id });
      for (let i = 0; i < built.socialObjects; i += 1) trackEvent("creator_social_object_created", { shopId: shop.id });
      // Pilot funnel.
      trackEvent("first_nest_created", { shopId: shop.id });
      trackEvent("room_saved", { shopId: shop.id });
      trackEvent("onboarding_completed", { shopId: shop.id });

      if (typeof window !== "undefined") window.localStorage.setItem(ONBOARDED_KEY, "true");
      // 4. Land in the new room.
      router.push(`/shop/${shop.address}`);
    } catch (err) {
      setError(friendlyError(err, "onboarding"));
      setBusy(false);
    }
  };

  return (
    <section className="shell grid min-h-[calc(100vh-4rem)] place-items-center py-12">
      <div className="card w-full max-w-lg rounded-[2.5rem] p-7 sm:p-9">
        <span className="grid size-12 place-items-center rounded-2xl bg-terracotta text-white"><WandSparkles size={22} /></span>
        <p className="mt-7 text-xs font-black uppercase tracking-[.2em] text-terracotta">Welcome{user ? `, ${user.name}` : ""}</p>
        <h1 className="display mt-2 text-4xl">Let’s build your first room.</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/50">Tell us what you make and drop your links — we’ll arrange a room from existing pieces. You can change everything later.</p>

        <form onSubmit={build} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">What do you create?</span>
            <input value={craft} onChange={(e) => setCraft(clampText(e.target.value, "craft"))} maxLength={LIMITS.craft} required placeholder="e.g. Wedding photographer · Indie developer · Ceramics shop" className="min-h-14 w-full rounded-2xl border border-ink/10 bg-white px-4 outline-none" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4"><Instagram size={18} className="text-ink/30" /><input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram" aria-label="Instagram" className="min-h-13 w-full bg-transparent py-3 outline-none" /></label>
            <label className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4"><Sparkles size={18} className="text-ink/30" /><input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="TikTok" aria-label="TikTok" className="min-h-13 w-full bg-transparent py-3 outline-none" /></label>
            <label className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4"><Youtube size={18} className="text-ink/30" /><input value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="YouTube" aria-label="YouTube" className="min-h-13 w-full bg-transparent py-3 outline-none" /></label>
            <label className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4"><Sparkles size={18} className="text-ink/30" /><input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website" aria-label="Website" className="min-h-13 w-full bg-transparent py-3 outline-none" /></label>
          </div>
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-terracotta">{error}</p>}
          <Button type="submit" variant="accent" className="w-full" disabled={busy || !craft.trim()}>
            {busy ? <><Loader2 size={18} className="animate-spin" /> Building your room…</> : <><WandSparkles size={18} /> Build my Nest</>}
          </Button>
        </form>
      </div>
    </section>
  );
}
