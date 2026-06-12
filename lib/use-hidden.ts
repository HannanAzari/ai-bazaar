"use client";

import { useEffect, useState } from "react";
import { hiddenRefs } from "@/lib/reports";

/** Reactive set of target refs (addresses/handles) moderators have hidden. */
export function useHiddenRefs(): Set<string> {
  const [refs, setRefs] = useState<Set<string>>(new Set());
  useEffect(() => {
    const sync = () => setRefs(hiddenRefs());
    sync();
    window.addEventListener("ai-bazaar-reports-changed", sync);
    return () => window.removeEventListener("ai-bazaar-reports-changed", sync);
  }, []);
  return refs;
}
