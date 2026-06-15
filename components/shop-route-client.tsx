"use client";

import { useEffect, useState } from "react";
import { useAllShops } from "@/components/providers/demo-provider";
import { ShopPageClient } from "@/components/shop-page-client";
import { getShopByAddress } from "@/lib/shop-claim";
import { isProductionBackend } from "@/lib/runtime-mode";
import type { Shop } from "@/lib/types";

export function ShopRouteClient({ address }: { address: string }) {
  // Demo seed shops (and the demo-claimed shop) resolve from local data; a
  // production-claimed shop is fetched from Supabase by address (public read).
  const demoShop = useAllShops().find((item) => item.address === address);
  const [remoteShop, setRemoteShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (demoShop || !isProductionBackend()) return;
    let active = true;
    setLoading(true);
    getShopByAddress(address)
      .then((shop) => active && setRemoteShop(shop))
      .catch(() => active && setRemoteShop(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [address, demoShop]);

  const shop = demoShop ?? remoteShop;

  if (!shop) {
    if (loading) {
      return <section className="shell grid min-h-[70vh] place-items-center py-12 text-center"><p className="text-ink/50">Opening the door…</p></section>;
    }
    return (
      <section className="shell grid min-h-[70vh] place-items-center py-12 text-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[.2em] text-terracotta">No place here</p>
          <h1 className="display mt-3 text-5xl">That door is still closed.</h1>
          <p className="mt-4 text-ink/50">Check the three-word address and try again.</p>
        </div>
      </section>
    );
  }

  return <ShopPageClient shop={shop} />;
}
