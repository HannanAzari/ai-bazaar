import { NestVisitorClient } from "./visitor-client";

// Public visitor route for a published Nest (M11). Resolves either a self-contained
// shareable link (?c=<encoded doc>, works in any browser) or a locally-published
// slug (owner's browser). Private/followers nests only resolve for their owner.

export const metadata = {
  title: "A cozy Nest",
  robots: { index: false, follow: false },
};

export default async function PublishedNestPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { slug } = await params;
  const { c } = await searchParams;
  return <NestVisitorClient slug={slug} encoded={c} />;
}
