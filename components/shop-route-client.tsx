"use client";

import { useAllShops } from "@/components/providers/demo-provider";
import { ShopPageClient } from "@/components/shop-page-client";

export function ShopRouteClient({ address }: { address: string }) {
  const shop = useAllShops().find((item) => item.address === address);

  if (!shop) {
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
