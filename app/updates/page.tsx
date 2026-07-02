import { redirect } from "next/navigation";

// M15.1: the Updates tab was renamed Notifications. Old links redirect.
export default function UpdatesPage() {
  redirect("/notifications");
}
