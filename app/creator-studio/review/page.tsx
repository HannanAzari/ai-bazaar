import type { Metadata } from "next";
import { ReviewClient } from "./review-client";

export const metadata: Metadata = {
  title: "Asset Review",
  robots: { index: false, follow: false },
};

// M21 — the dev-mode AI Asset Review panel (the future Admin Asset Factory).
// Gated behind developer mode; reuses the same engine + inventory as the Studio.
export default function ReviewPage() {
  return <ReviewClient />;
}
