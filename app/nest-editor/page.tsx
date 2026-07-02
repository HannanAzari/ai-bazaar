import { NestEditorClient } from "./nest-editor-client";

// The ONE Nestudio editor. Reached from every entry point (onboarding · templates)
// after a NestDocument is created — it opens on that document (?document=<id>). No
// placeholder / alternate editor exists anywhere. Internal/noindex during prototype.

export const metadata = {
  title: "Nest editor",
  robots: { index: false, follow: false },
};

export default async function NestEditorPage({
  searchParams,
}: {
  // `document` is the canonical param; `doc` accepted as a legacy alias.
  searchParams: Promise<{ document?: string; doc?: string }>;
}) {
  const sp = await searchParams;
  return <NestEditorClient docId={sp.document ?? sp.doc} />;
}
