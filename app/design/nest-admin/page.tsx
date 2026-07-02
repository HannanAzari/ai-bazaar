import { NestAdminClient } from "./admin-client";

// Internal, unlinked admin curation prototype (M10). No real auth — gated by a local
// admin-mode flag. Curates the production library (approve/hide/archive/feature) and
// creates templates. Items are NEVER hard-deleted. Not linked from the app.

export const metadata = {
  title: "Nest admin — curation",
  robots: { index: false, follow: false },
};

export default function NestAdminPage() {
  return <NestAdminClient />;
}
