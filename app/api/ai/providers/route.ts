import { NextResponse } from "next/server";

// M32 — server-truth availability. The client asset-pipeline can't read API keys,
// so it asks here which providers are actually configured. Honest: a provider with
// no key reports false and the UI greys it out (never pretends it's ready). `local`
// always works (offline canvas). Adding a key later flips a provider to true with no
// client change — switching is one config away.

export function GET() {
  return NextResponse.json({
    "gpt-image": !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    imagen: !!process.env.IMAGEN_API_KEY,
    flux: !!process.env.FLUX_API_KEY,
    local: true,
  });
}
