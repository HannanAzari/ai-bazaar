/**
 * /asset-factory — Asset Factory v1 · Founder Edition (mobile-first).
 *
 * The permanent real-time asset-generation workflow. Describe → Nestudio Translator spec
 * → generate one candidate through the frozen DNA pipeline → review → approve/regenerate/
 * edit/reject. The editor's Create tile opens this. No code, no JSON, no terminal.
 *
 * Approved assets save to the Nestudio library. The canonical Supabase write is a separate,
 * provisioning-gated step; this build proves the full workflow up to save + local library.
 */
import { AssetFactoryClient } from "./asset-factory-client";

export const metadata = { title: "Asset Factory · Nestudio", robots: { index: false, follow: false } };

export default function AssetFactoryPage() {
  return <AssetFactoryClient />;
}
