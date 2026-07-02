"use client";

import type { NestOverlay } from "@/lib/nest-editor-types";

// M13 (Task 4B): renders a generic overlay's CONTENT (text or image) filling its object
// box. Shared by the editor canvas and the visitor stage so an overlay looks identical
// while authoring and when published. Purely visual + non-interactive (pointer-events
// are owned by the parent object button); text scales with the box via container units.
export function OverlayContent({ overlay }: { overlay: NestOverlay }) {
  if (overlay.kind === "text") {
    return (
      <div className="pointer-events-none flex h-full w-full items-center justify-center overflow-hidden" style={{ containerType: "size" }}>
        <span
          className="w-full whitespace-pre-wrap break-words font-black leading-[1.05]"
          style={{ color: overlay.color ?? "#38291d", textAlign: overlay.align ?? "center", fontSize: "34cqmin" }}
        >
          {overlay.text}
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={overlay.src}
      alt=""
      draggable={false}
      className={`pointer-events-none h-full w-full ${overlay.fit === "cover" ? "object-cover" : "object-contain"}`}
    />
  );
}
