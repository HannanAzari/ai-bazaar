// Factory runtime mode (V2). Mirrors the main app's env-derived signal but is
// the factory's OWN, decoupled helper. "supabase" when the Supabase URL + anon
// key are present (the shared-backend signal); otherwise "demo" (localStorage).
//
// Detection keys off the public env so client and server agree. Actual DB/storage
// writes happen server-side with the service role (see lib/supabase-server.ts).

export type FactoryMode = "demo" | "supabase";

export function getFactoryMode(): FactoryMode {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anon ? "supabase" : "demo";
}

export function isSupabaseMode(): boolean {
  return getFactoryMode() === "supabase";
}
