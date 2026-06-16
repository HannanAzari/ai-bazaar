"use client";

import { useState } from "react";

/** Image with a graceful placeholder fallback (sample images may not exist). */
export function AssetThumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="placeholder">{alt || "no image"}</div>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} onError={() => setFailed(true)} />;
}
