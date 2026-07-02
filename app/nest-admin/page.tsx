import { redirect } from "next/navigation";

// M13 (Task 7): canonical top-level alias for the Nest admin curation tool. The tool
// itself lives at /design/nest-admin (internal, local admin-mode flag gate); this route
// makes the shorter /nest-admin path resolve to it so either URL works.
export const metadata = {
  title: "Nest admin",
  robots: { index: false, follow: false },
};

export default function NestAdminAlias() {
  redirect("/design/nest-admin");
}
