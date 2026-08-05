"use client";

import { NestRuntime } from "@/components/nest/app-shell/nest-runtime";
import type { NestDocument } from "@/lib/nest-document-types";

// ── M24E — NestPreview is now a thin adapter over the ONE runtime ────────────
//
// The implementation moved to `nest-runtime.tsx`. This file stays because ~10 call sites
// (Profile cards, the feed, discovery, search, the parity bench) name `NestPreview`, and
// churning them would be noise in a correctness sprint. It contains no rendering logic and
// no behaviour of its own — it maps the old prop shape onto `NestRuntime`'s `mode`, which
// is the only thing any mode is allowed to vary.
//
// Prefer `NestRuntime` directly in new code; it names what the component actually is.

export function NestPreview({
  doc,
  className,
  rounded,
  safe,
  interactive = false,
  surround = false,
}: {
  doc: NestDocument;
  className?: string;
  rounded?: string;
  safe?: { top?: number; bottom?: number };
  /** Legacy flag. `true` ⇒ the full interactive runtime; `false` ⇒ an inert card. */
  interactive?: boolean;
  surround?: boolean;
}) {
  return (
    <NestRuntime
      document={doc}
      mode={interactive ? "visitor" : "card"}
      className={className}
      rounded={rounded}
      safe={safe}
      surround={surround}
    />
  );
}
