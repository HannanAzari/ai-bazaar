import { NestTemplatesClient } from "./templates-client";

// Internal, unlinked template gallery (M10): browse every production template with
// its curation status, preview it, or open it in the editor. Not linked from the app.

export const metadata = {
  title: "Nest templates",
  robots: { index: false, follow: false },
};

export default function NestTemplatesPage() {
  return <NestTemplatesClient />;
}
