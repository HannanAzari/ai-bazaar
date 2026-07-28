/**
 * /nest-factory — Nest Factory v1 · Founder Edition (mobile-first).
 *
 * Founder-only. Same architecture + UX as Asset Factory — only the generation engine
 * differs: describe an EMPTY room → Nest Translator → Nest DNA → generate (text-to-image,
 * architecture only) → review → approve → publish to the dedicated Nest Library
 * (nest_backgrounds). Published Nests become selectable in Create → Build My Own for
 * manual decoration. No AI decoration, no furniture, no props — architecture only.
 */
import { NestFactoryClient } from "./nest-factory-client";

export const metadata = { title: "Nest Factory", robots: { index: false, follow: false } };

export default function NestFactoryPage() {
  return <NestFactoryClient />;
}
