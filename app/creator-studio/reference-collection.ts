/**
 * reference-collection.ts — the M22 consistency-test collection.
 * -----------------------------------------------------------------------------
 * Twelve object *sources* hand-drawn by the (AI) Art Director in ONE restrained
 * Nestudio palette — warm neutrals + a single quiet accent each, matte, rounded,
 * centered on a removable light ground. Fed through the same locked pipeline they
 * come back as one coherent design language (Phase 7). In production these stand
 * in for the user's uploaded photos; here they let us judge collection coherence.
 */

import type { ImageInput } from "@/lib/ai";

// The locked family palette — every object draws only from these.
const C = {
  ground: "#ecebe6",
  clay: "#c8775f",
  clayDark: "#a95740",
  caramel: "#d6a24a",
  caramelDark: "#b9853a",
  sage: "#8aa06a",
  sageDark: "#6f8654",
  stone: "#b7a684",
  stoneDark: "#8f8064",
  parchment: "#e7d6ac",
  ink: "#4f4030",
  cream: "#f3ead2",
};

function svg(inner: string): string {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="${C.ground}"/>${inner}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(doc)}`;
}

const shadow = `<ellipse cx="256" cy="392" rx="110" ry="16" fill="rgba(60,44,28,0.10)"/>`;

export type ReferenceObject = { id: string; label: string; subject: string; input: ImageInput };

function obj(id: string, label: string, subject: string, inner: string): ReferenceObject {
  return { id, label, subject, input: { fileName: `${id}.svg`, mimeType: "image/svg+xml", dataUrl: svg(shadow + inner) } };
}

export const REFERENCE_COLLECTION: ReferenceObject[] = [
  obj("mug", "Coffee mug", "coffee mug",
    `<rect x="188" y="196" width="120" height="150" rx="24" fill="${C.clay}"/>
     <path d="M308 232 q64 0 64 56 t-64 56" fill="none" stroke="${C.clay}" stroke-width="24"/>
     <ellipse cx="248" cy="200" rx="62" ry="16" fill="${C.clayDark}"/>`),
  obj("book", "Book", "book",
    `<rect x="176" y="216" width="170" height="150" rx="10" fill="${C.caramel}"/>
     <rect x="188" y="226" width="150" height="130" rx="6" fill="${C.cream}"/>
     <rect x="176" y="216" width="20" height="150" rx="8" fill="${C.caramelDark}"/>`),
  obj("camera", "Camera", "camera",
    `<rect x="168" y="228" width="176" height="118" rx="20" fill="${C.stone}"/>
     <rect x="220" y="212" width="72" height="24" rx="8" fill="${C.stoneDark}"/>
     <circle cx="256" cy="288" r="42" fill="${C.ink}"/><circle cx="256" cy="288" r="28" fill="${C.clay}"/>
     <circle cx="316" cy="250" r="8" fill="${C.caramel}"/>`),
  obj("controller", "Controller", "game controller",
    `<path d="M150 300 q-8 -60 46 -60 h120 q54 0 46 60 q-6 44 -46 44 q-30 0 -40 -22 h-40 q-10 22 -40 22 q-40 0 -46 -44Z" fill="${C.stone}"/>
     <circle cx="196" cy="286" r="9" fill="${C.ink}"/><circle cx="316" cy="286" r="9" fill="${C.clay}"/>
     <rect x="182" y="282" width="10" height="26" rx="3" fill="${C.ink}"/><rect x="170" y="294" width="26" height="10" rx="3" fill="${C.ink}"/>`),
  obj("keyboard", "Keyboard", "keyboard",
    `<rect x="150" y="252" width="212" height="86" rx="14" fill="${C.stone}"/>
     ${Array.from({ length: 3 }, (_, r) => Array.from({ length: 8 }, (_, k) => `<rect x="${168 + k * 22}" y="${264 + r * 22}" width="16" height="16" rx="4" fill="${C.cream}"/>`).join("")).join("")}`),
  obj("headphones", "Headphones", "headphones",
    `<path d="M176 300 v-24 a80 80 0 0 1 160 0 v24" fill="none" stroke="${C.sageDark}" stroke-width="18"/>
     <rect x="160" y="292" width="40" height="72" rx="18" fill="${C.sage}"/>
     <rect x="312" y="292" width="40" height="72" rx="18" fill="${C.sage}"/>`),
  obj("plant", "Plant", "potted plant",
    `<path d="M216 348 h80 l-12 -60 h-56Z" fill="${C.clay}"/>
     <circle cx="256" cy="228" r="34" fill="${C.sage}"/><circle cx="220" cy="252" r="26" fill="${C.sageDark}"/><circle cx="292" cy="252" r="26" fill="${C.sage}"/>
     <rect x="252" y="252" width="8" height="40" fill="${C.sageDark}"/>`),
  obj("chair", "Chair", "armchair",
    `<rect x="180" y="196" width="152" height="96" rx="30" fill="${C.sage}"/>
     <rect x="184" y="264" width="144" height="80" rx="24" fill="${C.sageDark}"/>
     <rect x="176" y="250" width="34" height="96" rx="16" fill="${C.sage}"/><rect x="302" y="250" width="34" height="96" rx="16" fill="${C.sage}"/>`),
  obj("lamp", "Lamp", "table lamp",
    `<path d="M206 236 h100 l-18 64 h-64Z" fill="${C.caramel}"/>
     <rect x="250" y="300" width="12" height="60" fill="${C.stoneDark}"/>
     <rect x="216" y="356" width="80" height="16" rx="8" fill="${C.ink}"/>`),
  obj("guitar", "Guitar", "acoustic guitar",
    `<ellipse cx="256" cy="300" rx="70" ry="60" fill="${C.caramel}"/>
     <ellipse cx="256" cy="230" rx="44" ry="40" fill="${C.caramel}"/>
     <circle cx="256" cy="268" r="18" fill="${C.ink}"/>
     <rect x="248" y="120" width="16" height="120" rx="6" fill="${C.caramelDark}"/>
     <rect x="240" y="104" width="32" height="28" rx="6" fill="${C.ink}"/>`),
  obj("notebook", "Notebook", "spiral notebook",
    `<rect x="188" y="212" width="150" height="150" rx="10" fill="${C.clay}"/>
     <rect x="204" y="226" width="120" height="122" rx="6" fill="${C.cream}"/>
     ${Array.from({ length: 6 }, (_, i) => `<circle cx="${196}" cy="${232 + i * 22}" r="6" fill="${C.ink}"/>`).join("")}`),
  obj("clock", "Clock", "wall clock",
    `<circle cx="256" cy="284" r="76" fill="${C.stone}"/><circle cx="256" cy="284" r="60" fill="${C.cream}"/>
     <rect x="252" y="240" width="8" height="48" rx="4" fill="${C.ink}"/><rect x="256" y="280" width="40" height="7" rx="3" fill="${C.clay}"/>
     <circle cx="256" cy="284" r="7" fill="${C.ink}"/>`),
];
