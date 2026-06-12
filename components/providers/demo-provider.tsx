"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createThreeWordAddress } from "@/lib/addresses";
import { bazaars, shops } from "@/lib/data";
import { recordActivity } from "@/lib/activity";
import { flags } from "@/lib/flags";
import type { Decoration, GenerationJob, HouseExterior, RoomZone, Shop, ShopLink } from "@/lib/types";

type DemoUser = {
  name: string;
  email: string;
} | null;

const defaultExterior: HouseExterior = {
  color: "terracotta",
  roofStyle: "gable",
  gardenStyle: "wildflowers",
  signText: "Welcome in",
};

type DemoContextValue = {
  user: DemoUser;
  ownedShop: Shop | null;
  likedShops: Set<string>;
  followedOwners: Set<string>;
  jobs: GenerationJob[];
  login: (email?: string) => void;
  logout: () => void;
  claimShop: (bazaarId: string, slotNumber: number, customSecond?: string, customThird?: string) => Shop | null;
  toggleLike: (shopId: string) => void;
  toggleFollow: (ownerHandle: string) => void;
  addDecoration: (decoration: Decoration) => void;
  updateShop: (updates: Partial<Pick<Shop, "name" | "tagline" | "bio" | "exterior" | "tags">>) => void;
  addShopLink: (link: ShopLink) => void;
  setShopTags: (tags: string[]) => void;
  setDecorationTags: (decorationId: string, tags: string[]) => void;
  setLinkTags: (linkId: string, tags: string[]) => void;
  createGeneration: (prompt: string, zone?: RoomZone) => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DemoUser>(null);
  const [ownedShop, setOwnedShop] = useState<Shop | null>(null);
  const [likedShops, setLikedShops] = useState<Set<string>>(new Set());
  const [followedOwners, setFollowedOwners] = useState<Set<string>>(new Set());
  const [jobs, setJobs] = useState<GenerationJob[]>([]);

  useEffect(() => {
    const savedUser = window.localStorage.getItem("ai-bazaar-user");
    const savedShop = window.localStorage.getItem("ai-bazaar-shop");
    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedShop) {
      const parsed = JSON.parse(savedShop) as Shop;
      const village = bazaars.find((item) => item.id === parsed.bazaarId);
      if (village && !parsed.address.startsWith(`${village.addressPrefix}.`)) {
        const words = parsed.address.split(".");
        parsed.address = `${village.addressPrefix}.${words.at(-2) ?? "tiny"}.${words.at(-1) ?? "house"}`;
      }
      if (parsed.slotNumber > 24) parsed.slotNumber = 24;
      parsed.decorations = (parsed.decorations ?? []).map((item) => ({ ...item, zone: item.zone ?? "floor" }));
      parsed.exterior = parsed.exterior ?? defaultExterior;
      setOwnedShop(parsed);
    }
  }, []);

  useEffect(() => {
    if (user) window.localStorage.setItem("ai-bazaar-user", JSON.stringify(user));
    else window.localStorage.removeItem("ai-bazaar-user");
  }, [user]);

  useEffect(() => {
    if (ownedShop) window.localStorage.setItem("ai-bazaar-shop", JSON.stringify(ownedShop));
  }, [ownedShop]);

  const value = useMemo<DemoContextValue>(
    () => ({
      user,
      ownedShop,
      likedShops,
      followedOwners,
      jobs,
      login: (email = "maker@example.com") =>
        setUser({ name: "Bazaar Maker", email }),
      logout: () => setUser(null),
      claimShop: (bazaarId, slotNumber, customSecond, customThird) => {
        if (!user || ownedShop) return null;
        const village = bazaars.find((item) => item.id === bazaarId);
        if (!village) return null;
        const address = createThreeWordAddress(village.addressPrefix, Date.now(), customSecond, customThird);
        if (shops.some((shop) => shop.address === address)) return null;
        const nextShop: Shop = {
          id: `demo-${Date.now()}`,
          address,
          bazaarId,
          slotNumber,
          name: "My Little Place",
          owner: user.name,
          ownerHandle: "@bazaarmaker",
          tagline: "A new world is taking shape.",
          bio: "Welcome in. This little place is just getting started.",
          avatar: "ML",
          palette: "from-orange-200 via-rose-100 to-teal-200",
          cover: "new",
          likes: 0,
          followers: 0,
          visitors: 1,
          createdAt: new Date().toISOString().slice(0, 10),
          links: [],
          decorations: [],
          exterior: defaultExterior,
          tags: [],
        };
        setOwnedShop(nextShop);
        if (flags.activityFeed) {
          recordActivity({ type: "claimed_house", actorName: user.name, actorHandle: nextShop.ownerHandle, summary: `claimed a house in ${village.name}`, href: `/shop/${address}` });
        }
        return nextShop;
      },
      toggleLike: (shopId) =>
        setLikedShops((current) => {
          const next = new Set(current);
          if (next.has(shopId)) next.delete(shopId);
          else next.add(shopId);
          return next;
        }),
      toggleFollow: (ownerHandle) =>
        setFollowedOwners((current) => {
          const next = new Set(current);
          if (next.has(ownerHandle)) next.delete(ownerHandle);
          else next.add(ownerHandle);
          return next;
        }),
      addDecoration: (decoration) => {
        setOwnedShop((current) =>
          current ? { ...current, decorations: [...current.decorations, decoration] } : current,
        );
        if (flags.activityFeed && ownedShop) {
          recordActivity({ type: "added_decoration", actorName: ownedShop.owner, actorHandle: ownedShop.ownerHandle, summary: `added ${decoration.title} to ${ownedShop.name}`, href: `/shop/${ownedShop.address}` });
        }
      },
      updateShop: (updates) =>
        setOwnedShop((current) => (current ? { ...current, ...updates } : current)),
      addShopLink: (link) =>
        setOwnedShop((current) =>
          current ? { ...current, links: [...current.links, link] } : current,
        ),
      setShopTags: (tags) =>
        setOwnedShop((current) => (current ? { ...current, tags } : current)),
      setDecorationTags: (decorationId, tags) =>
        setOwnedShop((current) =>
          current
            ? {
                ...current,
                decorations: current.decorations.map((item) =>
                  item.id === decorationId ? { ...item, tags } : item,
                ),
              }
            : current,
        ),
      setLinkTags: (linkId, tags) =>
        setOwnedShop((current) =>
          current
            ? {
                ...current,
                links: current.links.map((link) =>
                  link.id === linkId ? { ...link, tags } : link,
                ),
              }
            : current,
        ),
      createGeneration: (prompt, zone = "floor") => {
        const id = `job-${Date.now()}`;
        const job: GenerationJob = {
          id,
          prompt,
          status: "building",
          createdAt: new Date().toISOString(),
        };
        setJobs((current) => [job, ...current]);
        window.setTimeout(() => {
          setJobs((current) =>
            current.map((item) => (item.id === id ? { ...item, status: "complete" } : item)),
          );
          setOwnedShop((current) =>
            current
              ? {
                  ...current,
                  decorations: [
                    ...current.decorations,
                    {
                      id: `decoration-${Date.now()}`,
                      type: "ai-image",
                      title: "AI-made decoration",
                      content: prompt,
                      palette: "from-amber-300 via-rose-200 to-teal-300",
                      zone,
                    },
                  ],
                }
              : current,
          );
        }, 2400);
      },
    }),
    [user, ownedShop, likedShops, followedOwners, jobs],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo must be used inside DemoProvider");
  return value;
}

export function useAllShops() {
  const { ownedShop } = useDemo();
  return ownedShop ? [ownedShop, ...shops] : shops;
}
