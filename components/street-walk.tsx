"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Flower2, Footprints, Heart, Leaf, Sparkles, TreePine, X } from "lucide-react";
import { useAllShops, useDemo } from "@/components/providers/demo-provider";
import { HOUSES_PER_VILLAGE } from "@/lib/data";
import { normalizeAddressWord } from "@/lib/addresses";
import type { Bazaar } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { House } from "@/components/scene/house";
import { cn } from "@/lib/utils";

export function StreetWalk({ bazaar }: { bazaar: Bazaar }) {
  const router = useRouter();
  const rail = useRef<HTMLDivElement>(null);
  const allShops = useAllShops();
  const { user, ownedShop, claimShop, likedShops, toggleLike } = useDemo();
  const [claiming, setClaiming] = useState<number | null>(null);
  const [secondWord, setSecondWord] = useState("tiny");
  const [thirdWord, setThirdWord] = useState("house");
  const residents = allShops.filter((place) => place.bazaarId === bazaar.id);
  const firstResidentSlot = residents[0]?.slotNumber ?? 1;
  const proposedAddress = `${bazaar.addressPrefix}.${normalizeAddressWord(secondWord) || "tiny"}.${normalizeAddressWord(thirdWord) || "house"}`;
  const addressTaken = allShops.some((place) => place.address === proposedAddress);

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    element.scrollLeft = Math.max(0, (firstResidentSlot - 2) * (window.innerWidth < 640 ? 220 : 258));
  }, [bazaar.id, firstResidentSlot]);

  const move = (direction: number) =>
    rail.current?.scrollBy({ left: direction * Math.min(window.innerWidth * 0.86, 760), behavior: "smooth" });

  const chooseDoor = (houseNumber: number, occupied: boolean) => {
    const resident = residents.find((place) => place.slotNumber === houseNumber);
    if (resident) return router.push(`/shop/${resident.address}`);
    if (occupied || ownedShop) return;
    if (!user) return router.push(`/auth/login?next=/bazaar/${bazaar.slug}`);
    setClaiming(houseNumber);
  };

  const confirmClaim = () => {
    if (claiming === null || addressTaken) return;
    const place = claimShop(bazaar.id, claiming, secondWord, thirdWord);
    if (place) router.push("/studio");
  };

  return (
    <div className="relative">
      {/* Navigation bar */}
      <div className="mb-4 flex items-center justify-between px-4 sm:px-0">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-ink/45">
          <Footprints size={15} /> Walk around the circle
        </p>
        <div className="flex gap-2">
          <button onClick={() => move(-1)} className="grid size-10 place-items-center rounded-full border border-ink/10 bg-white/80 shadow-sm" aria-label="Walk left">
            <ArrowLeft size={17} />
          </button>
          <button onClick={() => move(1)} className="grid size-10 place-items-center rounded-full bg-ink text-white shadow-sm" aria-label="Walk right">
            <ArrowRight size={17} />
          </button>
        </div>
      </div>

      {/* ── Street scene ─────────────────────────────────────────── */}
      <div
        ref={rail}
        className="street-sky hide-scrollbar snap-rail relative -mx-4 overflow-x-auto rounded-[2rem] border-y border-white/60 shadow-inner sm:mx-0 sm:rounded-[2.5rem]"
      >
        {/* Houses rail — large gaps so each house feels detached */}
        <div className="relative flex h-[565px] w-max min-w-full items-end gap-16 px-[7vw] pb-[96px] pt-16 sm:h-[635px] sm:gap-24 sm:px-20 sm:pb-[108px]">
          {/* Scene layers span the full street width and scroll with the houses */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {/* Each village tints its own sky, so streets feel distinct */}
            <div
              className="absolute inset-0 mix-blend-multiply"
              style={{ background: `linear-gradient(180deg, ${bazaar.soft}66 0%, transparent 45%)` }}
            />
            {/* Drifting clouds */}
            {[6, 21, 38, 54, 71, 88].map((xPct, i) => (
              <span
                key={i}
                className="cloud absolute"
                style={{
                  left: `${xPct}%`,
                  top: `${5 + (i % 3) * 5}%`,
                  width: 70 + (i % 3) * 26,
                  height: 17 + (i % 2) * 6,
                  animationDelay: `${i * 1.4}s`,
                }}
              />
            ))}
            {/* Rolling hills behind the houses give the street depth */}
            <div className="street-hills absolute inset-x-0 bottom-[24%] h-[26%] opacity-70" />
            {/* Village road surface */}
            <div className="absolute inset-x-0 bottom-0 h-[25%] bg-[#a78967]" />
            <div className="street-cobbles absolute inset-x-0 bottom-0 h-[25%] opacity-50" />
            {/* Soft grass verge between plots and road */}
            <div className="absolute inset-x-0 bottom-[24%] h-7 bg-gradient-to-b from-[#7aaa52]/55 via-[#6a9944]/35 to-transparent" />
            {/* Ambient fireflies floating in the air */}
            {[4, 11, 19, 26, 34, 41, 49, 56, 64, 71, 79, 86, 94].map((xPct, i) => (
              <span
                key={`fly-${i}`}
                className="firefly absolute size-1.5 rounded-full bg-amber-300"
                style={{
                  left: `${xPct}%`,
                  top: `${20 + (i % 4) * 10}%`,
                  animationDelay: `${i * 0.75}s`,
                }}
              />
            ))}
          </div>
          {Array.from({ length: HOUSES_PER_VILLAGE }, (_, index) => {
            const houseNumber = index + 1;
            const resident = residents.find((place) => place.slotNumber === houseNumber);
            const occupied = index < bazaar.claimed;
            const available = !occupied && !resident;
            const isOwned = Boolean(resident && ownedShop && resident.id === ownedShop.id);
            const liked = resident ? likedShops.has(resident.id) : false;

            const treeLeft = index % 2 === 0;       // tree alternates sides
            const flowerVariant = index % 3;        // 0=red+pink, 1=yellow+white, 2=purple+orange

            const flowerColors = [
              ["text-rose-500", "text-pink-400", "text-amber-400"],
              ["text-yellow-400", "text-white/90", "text-lime-400"],
              ["text-purple-500", "text-orange-400", "text-rose-300"],
            ][flowerVariant];

            return (
              <article
                key={houseNumber}
                className={cn(
                  "group relative h-[455px] w-[228px] shrink-0 snap-center transition-transform duration-300 hover:-translate-y-3 sm:h-[515px] sm:w-[256px]",
                  isOwned && "drop-shadow-[0_0_14px_rgba(233,155,62,.8)]"
                )}
              >
                {/* ── Individual grass plot ─────────────────────────── */}
                <div className="absolute inset-x-0 bottom-0 h-[28%] overflow-visible">
                  {/* Grass base — rounded oval, each plot its own island */}
                  <div className="absolute inset-0 rounded-[50%_50%_18%_18%] border border-emerald-700/15 bg-gradient-to-b from-[#96cc6e] to-[#6b9a48] shadow-[0_8px_22px_rgba(30,70,10,.18)]" />

                  {/* Stone path leading to the door (door sits right of centre) */}
                  <div className="pointer-events-none absolute bottom-0 left-[63%] flex -translate-x-1/2 flex-col-reverse items-center gap-[3px] pb-1" aria-hidden="true">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="rounded-full bg-[#cebfa0] shadow-sm"
                        style={{
                          width: `${8 + i * 4}px`,
                          height: "5px",
                          transform: `rotate(${(i % 2 === 0 ? 1 : -1) * (i + 2)}deg)`,
                          opacity: 0.85 + i * 0.04,
                        }}
                      />
                    ))}
                  </div>

                  {/* Tree — sways gently */}
                  <div className={cn("absolute bottom-4", treeLeft ? "left-2" : "right-2")} aria-hidden="true">
                    <TreePine
                      size={26}
                      className="sway-tree text-emerald-800"
                      fill="currentColor"
                      strokeWidth={1.3}
                      style={{ animationDelay: `${index * 0.38}s` }}
                    />
                  </div>

                  {/* Wildflower cluster on the opposite side */}
                  <div className={cn("absolute bottom-2 flex items-end gap-[2px]", treeLeft ? "right-3" : "left-3")} aria-hidden="true">
                    <Leaf size={13} className="text-emerald-700" fill="currentColor" />
                    <Flower2 size={12} className={flowerColors[0]} fill="currentColor" />
                    <Flower2 size={10} className={flowerColors[1]} fill="currentColor" />
                    <Flower2 size={9} className={flowerColors[2]} fill="currentColor" />
                  </div>

                  {/* Pebbles scattered near the path edge */}
                  <div className={cn("absolute bottom-3 flex items-end gap-1", treeLeft ? "left-9" : "right-9")} aria-hidden="true">
                    <span className="h-1.5 w-2.5 rounded-full bg-[#bdb09a] shadow-sm" />
                    <span className="h-1 w-1.5 rounded-full bg-[#a99c85]" />
                    <span className="h-1 w-2 rounded-full bg-[#cabfa8]" />
                  </div>

                  {/* Wooden "open" sign on the lawn — only when this house can be claimed */}
                  {available && (
                    <div className={cn("absolute bottom-7", treeLeft ? "right-5" : "left-5")}>
                      <span className="block h-5 w-[46px] rotate-[-1.5deg] rounded-sm border border-[#7c5436]/55 bg-[#f4dcaa] px-1 text-center text-[6px] font-black leading-5 tracking-wide text-ink/60 shadow-sm">
                        OPEN
                      </span>
                      <span className="mx-auto block h-5 w-0.5 bg-[#7c5436]/70" />
                    </div>
                  )}

                  {/* Little mailbox by the path for lived-in homes */}
                  {occupied && !available && (
                    <div className={cn("absolute bottom-6", treeLeft ? "right-7" : "left-7")} aria-hidden="true">
                      <span className="block h-3 w-4 rounded-t-full border border-[#7c5436]/50 bg-[#c2553e] shadow-sm">
                        <span className="absolute left-1/2 top-1 h-px w-2 -translate-x-1/2 bg-white/70" />
                      </span>
                      <span className="mx-auto block h-4 w-0.5 bg-[#7c5436]/70" />
                    </div>
                  )}
                </div>

                {/* ── House — seeded by village + slot, stable forever ── */}
                <div className="absolute bottom-[16%] left-1/2 w-[94%] -translate-x-1/2 transition-transform duration-300 group-hover:-translate-y-1.5">
                  <House
                    seed={`${bazaar.id}:${houseNumber}`}
                    accent={bazaar.accent}
                    lod="street"
                    state={isOwned ? "owned" : resident || occupied ? "lived" : "open"}
                    name={resident?.name}
                  />
                  {/* Invisible accessible click overlay covers the building */}
                  <button
                    onClick={() => chooseDoor(houseNumber, occupied)}
                    disabled={!resident && (occupied || Boolean(ownedShop))}
                    className="absolute inset-x-[6%] bottom-[7%] top-[26%] z-20 rounded-3xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/55"
                    aria-label={
                      resident
                        ? `Enter ${resident.name}`
                        : available && !ownedShop
                        ? `Claim open house ${houseNumber}`
                        : `House ${houseNumber} is occupied`
                    }
                  />
                </div>

                {/* Like button — floating heart, doesn't block house entry */}
                {resident && (
                  <button
                    onClick={() => toggleLike(resident.id)}
                    className={cn(
                      "absolute right-1 top-[35%] z-30 grid size-8 place-items-center rounded-full border-2 border-white shadow-md transition-transform hover:scale-110",
                      liked ? "bg-terracotta text-white" : "bg-white/90 text-ink"
                    )}
                    aria-label={liked ? `Unlike ${resident.name}` : `Like ${resident.name}`}
                  >
                    <Heart size={12} fill={liked ? "currentColor" : "none"} />
                  </button>
                )}

                {/* Owned home sparkle badge */}
                {isOwned && (
                  <span className="absolute left-1 top-[35%] z-30 grid size-8 place-items-center rounded-full bg-saffron shadow-md">
                    <Sparkles size={13} fill="currentColor" />
                  </span>
                )}
              </article>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-ink/40">Swipe sideways to follow the circular road past all 24 homes.</p>

      {/* ── Claim address modal ───────────────────────────────────── */}
      {claiming !== null && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/35 p-5 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-[2rem] border border-white/70 bg-[#fff8e9] p-7 shadow-2xl">
            <button
              onClick={() => setClaiming(null)}
              className="absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-white"
              aria-label="Close address picker"
            >
              <X size={17} />
            </button>
            <p className="eyebrow text-terracotta">House {claiming} · {bazaar.name}</p>
            <h2 className="display mt-2 text-4xl">Name your address.</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/50">
              The village name always comes first. Choose two words that feel like yours.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              <div className="flex min-h-12 items-center rounded-xl bg-ink px-3 text-sm font-black text-white">
                {bazaar.addressPrefix}
              </div>
              <input
                value={secondWord}
                onChange={(event) => setSecondWord(event.target.value)}
                aria-label="Second address word"
                className="min-w-0 rounded-xl border border-ink/10 bg-white px-3 text-sm outline-none focus:border-terracotta"
              />
              <input
                value={thirdWord}
                onChange={(event) => setThirdWord(event.target.value)}
                aria-label="Third address word"
                className="min-w-0 rounded-xl border border-ink/10 bg-white px-3 text-sm outline-none focus:border-terracotta"
              />
            </div>
            <div className={cn("mt-3 rounded-xl px-4 py-3 text-sm font-bold", addressTaken ? "bg-rose-100 text-terracotta" : "bg-emerald-100 text-teal")}>
              {proposedAddress} {addressTaken ? "is already taken" : "is available"}
            </div>
            <Button
              onClick={confirmClaim}
              variant="accent"
              className="mt-5 w-full"
              disabled={addressTaken || !normalizeAddressWord(secondWord) || !normalizeAddressWord(thirdWord)}
            >
              Claim this home &amp; enter
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
