import { NestAppChrome } from "@/components/nest/app-shell/nest-app-chrome";
import { CreateClient } from "./create-client";

export const metadata = {
  title: "Create",
  robots: { index: false, follow: false },
};

export default function CreatePage() {
  return (
    <NestAppChrome>
      <CreateClient />
    </NestAppChrome>
  );
}
