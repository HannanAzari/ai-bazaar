import type { Metadata } from "next";
import { GptImageClient } from "./gpt-image-client";

export const metadata: Metadata = {
  title: "GPT Image — Nestudio (internal)",
  robots: { index: false, follow: false },
};

// Internal developer tool (M35 GPT Image). Runs the HONEST single-generation path
// (furniture@8, no conform/repair) on the two mug tests and shows every stage side by
// side with truthful metadata. NOT a user surface.
export default function GptImagePage() {
  return <GptImageClient />;
}
