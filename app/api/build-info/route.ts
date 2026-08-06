import { NextResponse } from "next/server";

// ── M26A-completion §1 — which build is this, and where is it running? ───────
//
// Public, secret-free, and cacheable-never. It exists to end a specific class of wasted
// sprint: the founder testing one deployment while the agent probes another, with neither
// able to prove which commit is actually being served.
//
// Everything here comes from Vercel's own build-time system environment. `VERCEL_GIT_*`
// are injected at build, so the commit reported is genuinely the commit that produced this
// bundle — not whatever HEAD happens to be now.

export const dynamic = "force-dynamic";

/** Only the project REF is exposed — never the URL's key material, never a token. */
function supabaseProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname.split(".")[0];
  } catch {
    return null;
  }
}

export function GET() {
  return NextResponse.json(
    {
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      commitShort: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      // The project SLUG, which is the part of a preview hostname that identifies the
      // Vercel project — this is the field that settles "are these two different
      // projects?" without anyone reading a dashboard.
      vercelProject: process.env.VERCEL_PROJECT_NAME ?? process.env.VERCEL_GIT_REPO_SLUG ?? null,
      vercelOwner: process.env.VERCEL_GIT_REPO_OWNER ?? null,
      vercelEnv: process.env.VERCEL_ENV ?? "local",
      /** The exact host serving this response, so a screenshot of the URL is verifiable. */
      deploymentUrl: process.env.VERCEL_URL ?? null,
      productionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
      supabaseProjectRef: supabaseProjectRef(),
      /** Whether the browser bundle got its Supabase vars AT BUILD TIME (D-10's trap). */
      supabaseConfiguredAtBuild: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ),
    },
    { headers: { "cache-control": "no-store, max-age=0" } },
  );
}
