import { notFound } from "next/navigation";
import { CreatorProfileClient } from "@/components/creator-profile-client";
import { Footer } from "@/components/footer";
import { shops } from "@/lib/data";
import { normalizeHandle } from "@/lib/creators";
import { flags } from "@/lib/flags";

// Pre-render the seed creators; owner-claimed handles resolve on demand.
export function generateStaticParams() {
  return shops.map((shop) => ({ handle: normalizeHandle(shop.ownerHandle) }));
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return { title: `@${normalizeHandle(handle)}` };
}

export default async function CreatorPage({ params }: { params: Promise<{ handle: string }> }) {
  if (!flags.creatorProfiles) notFound();
  const { handle } = await params;

  return (
    <>
      <CreatorProfileClient handle={normalizeHandle(decodeURIComponent(handle))} />
      <Footer />
    </>
  );
}
