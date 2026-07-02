import { NestEditorClient } from "./nest-editor-client";

// The ONE Nestudio editor (M11). Reached from onboarding after a template/background
// is chosen — it opens on a real NestDocument (?doc=<id>). No placeholder editor
// exists anymore. Internal/noindex during the prototype phase.

export const metadata = {
  title: "Nest editor",
  robots: { index: false, follow: false },
};

export default async function NestEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string }>;
}) {
  const sp = await searchParams;
  return <NestEditorClient docId={sp.doc} />;
}
