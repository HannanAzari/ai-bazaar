import { NestEditor } from "@/components/nest/editor/nest-editor";

// Internal, unlinked visual Nest Editor (M6 foundation). Loads the Golden Living
// Nest as an editable structured document; supports select / move / resize /
// reorder / add / remove / undo-redo / grid+snap / local save-load / JSON
// import-export, and a Preview mode that reuses the existing renderer. The editor
// authors structured manifests — it never bakes the Nest into an image. Not linked.

export const metadata = {
  title: "Nest Editor — Nestudio internal",
  robots: { index: false, follow: false },
};

export default function NestEditorPage() {
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-4">
      <NestEditor />
    </section>
  );
}
