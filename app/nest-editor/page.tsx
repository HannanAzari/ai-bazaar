import { NestEditorMount } from "./nest-editor-mount";

// The ONE Nestudio editor: the full production Nest Editor (Arrange · Assets ·
// Connect · Focus · Surface · Preview) restored from feat/nest-focus-detail-scenes.
// Every entry point (onboarding · templates) routes here with ?document=<id>; the
// editor opens on that NestDocument's selected production background. Internal/noindex.

export const metadata = {
  title: "Nest editor",
  robots: { index: false, follow: false },
};

export default async function NestEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ document?: string; doc?: string }>;
}) {
  const sp = await searchParams;
  return <NestEditorMount documentId={sp.document ?? sp.doc} />;
}
