/**
 * Sample source photos for the Studio — simple objects on a near-uniform light
 * background, so the pipeline's background-removal has something real to remove.
 * SVG data URIs (no external refs → safe to draw to canvas without tainting).
 * These stand in for a user's uploaded photo; production users upload their own.
 */

import type { ImageInput } from "@/lib/ai";

function svg(inner: string): string {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#ecebe6"/>${inner}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(doc)}`;
}

export type StudioSample = { id: string; label: string; subject: string; input: ImageInput };

export const SAMPLES: StudioSample[] = [
  {
    id: "mug",
    label: "Coffee mug",
    subject: "coffee mug",
    input: {
      fileName: "mug.svg",
      mimeType: "image/svg+xml",
      dataUrl: svg(
        `<ellipse cx="256" cy="392" rx="120" ry="20" fill="#d7d5cf"/>
         <rect x="176" y="200" width="150" height="180" rx="26" fill="#c86f52"/>
         <path d="M326 236 q70 0 70 60 t-70 60" fill="none" stroke="#c86f52" stroke-width="26"/>
         <ellipse cx="251" cy="204" rx="75" ry="20" fill="#a95740"/>
         <ellipse cx="251" cy="206" rx="60" ry="14" fill="#5a3327"/>`,
      ),
    },
  },
  {
    id: "chair",
    label: "Armchair",
    subject: "armchair",
    input: {
      fileName: "chair.svg",
      mimeType: "image/svg+xml",
      dataUrl: svg(
        `<ellipse cx="256" cy="410" rx="150" ry="22" fill="#d7d5cf"/>
         <rect x="150" y="150" width="212" height="150" rx="40" fill="#8aa06a"/>
         <rect x="150" y="250" width="212" height="120" rx="34" fill="#9cb27c"/>
         <rect x="140" y="230" width="46" height="150" rx="22" fill="#7d945e"/>
         <rect x="326" y="230" width="46" height="150" rx="22" fill="#7d945e"/>
         <rect x="170" y="368" width="28" height="46" rx="8" fill="#5c4a34"/>
         <rect x="314" y="368" width="28" height="46" rx="8" fill="#5c4a34"/>`,
      ),
    },
  },
  {
    id: "lamp",
    label: "Table lamp",
    subject: "table lamp",
    input: {
      fileName: "lamp.svg",
      mimeType: "image/svg+xml",
      dataUrl: svg(
        `<ellipse cx="256" cy="418" rx="90" ry="18" fill="#d7d5cf"/>
         <path d="M196 200 L316 200 L296 288 L216 288 Z" fill="#e7c46a"/>
         <rect x="250" y="288" width="12" height="112" fill="#7a6a55"/>
         <rect x="212" y="398" width="88" height="20" rx="10" fill="#6b5a44"/>`,
      ),
    },
  },
];
