import { ShopRouteClient } from "@/components/shop-route-client";
import { shops } from "@/lib/data";

export function generateStaticParams() {
  return shops.map((shop) => ({ address: shop.address }));
}

export default async function ShopPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  return <ShopRouteClient address={address} />;
}
