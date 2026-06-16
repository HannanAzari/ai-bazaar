"use client";

import { ReviewDashboard } from "@/components/review-dashboard";
import { ReviewerGate } from "@/components/reviewer-gate";

export default function Page() {
  return (
    <ReviewerGate>
      {(reviewer, onChange) => <ReviewDashboard reviewer={reviewer} onChangeReviewer={onChange} />}
    </ReviewerGate>
  );
}
