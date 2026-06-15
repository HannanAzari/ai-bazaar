import type { SupabaseClient } from "@supabase/supabase-js";
import type { Shop } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createThreeWordAddress } from "@/lib/addresses";

// Production shop ("Nest") claiming. Onboarding's "create first Nest" needs a real
// `shops` row in production before a room can be persisted (saveHouse looks the shop
// up by address; rooms RLS checks owns_shop). Demo mode keeps using DemoProvider's
// claimShop (localStorage) — this module is the production-only counterpart.
//
// Rules verified against the live schema (see docs/staging-checklist.md §0a):
// - address prefix must equal split_part(bazaars.slug,'-',1) (validate_shop_village_address)
// - slot_id must reference an unused shop_slots row
// - RLS "users claim one shop": owner_id = auth.uid() and no existing shop

/** The village address prefix for a bazaar slug (e.g. "moon-court" → "moon"). */
export function prefixFromSlug(slug: string): string {
  return slug.split("-")[0];
}

/** A three-word village address for a bazaar slug + seed (alpha-only, regex-safe). */
export function villageAddress(slug: string, seed: number): string {
  return createThreeWordAddress(prefixFromSlug(slug), seed);
}

/** First slot id in `slots` not present in `takenIds`, or null when the village is full. */
export function firstOpenSlotId(
  slots: { id: string; slot_number: number }[],
  takenIds: Set<string>,
): { id: string; slot_number: number } | null {
  const sorted = [...slots].sort((a, b) => a.slot_number - b.slot_number);
  return sorted.find((s) => !takenIds.has(s.id)) ?? null;
}

function client(injected?: SupabaseClient | null): SupabaseClient {
  const resolved = injected ?? createSupabaseBrowserClient();
  if (!resolved) throw new Error("Supabase client unavailable — production shop claim requires Supabase env vars.");
  return resolved;
}

type BazaarRow = { id: string; slug: string; name: string; position: number };

function toShop(row: Record<string, unknown>, bazaar: BazaarRow, slotNumber: number, ownerName: string): Shop {
  return {
    id: row.id as string,
    address: row.address as string,
    bazaarId: bazaar.slug,
    slotNumber,
    name: (row.display_name as string) ?? "My Nest",
    owner: ownerName,
    ownerHandle: `@${ownerName.toLowerCase().replace(/[^a-z0-9]+/g, "")}`,
    tagline: (row.tagline as string) ?? "A new place is taking shape.",
    bio: (row.bio as string) ?? "",
    avatar: "ML",
    palette: (row.palette as string) ?? "from-orange-200 via-rose-100 to-teal-200",
    cover: "new",
    likes: 0,
    followers: 0,
    visitors: Number(row.visitor_count ?? 0),
    createdAt: (row.created_at as string)?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    links: [],
    decorations: [],
  };
}

/** Load a shop by its three-word address from Supabase (public read), or null. */
export async function getShopByAddress(address: string, injected?: SupabaseClient | null): Promise<Shop | null> {
  const db = client(injected);
  const row = (await db.from("shops").select("*").eq("address", address).maybeSingle()).data as Record<string, unknown> | null;
  if (!row) return null;
  const slot = (await db.from("shop_slots").select("bazaar_id, slot_number").eq("id", row.slot_id as string).maybeSingle()).data as { bazaar_id: string; slot_number: number } | null;
  const bazaar = (slot
    ? (await db.from("bazaars").select("id, slug, name, position").eq("id", slot.bazaar_id).maybeSingle()).data
    : null) as BazaarRow | null;
  const fallback: BazaarRow = { id: "", slug: `${(row.address as string).split(".")[0]}-village`, name: "Village", position: 1 };
  return toShop(row, bazaar ?? fallback, slot?.slot_number ?? 1, (row.display_name as string) ?? "Maker");
}

/**
 * Claim the first available Nest for the signed-in user in production, or return
 * the one they already own (idempotent). Picks the first village with a free slot.
 */
export async function claimShopInSupabase(input: { displayName: string }, injected?: SupabaseClient | null): Promise<Shop> {
  const db = client(injected);
  const { data: auth } = await db.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("Must be signed in to claim a Nest.");
  const ownerName = input.displayName?.trim() || "Maker";

  const bazaars = (await db.from("bazaars").select("id, slug, name, position").order("position")).data as BazaarRow[] | null;
  if (!bazaars || bazaars.length === 0) throw new Error("No villages are available — apply seed.sql.");

  // Already own one? Return it (with its village + slot).
  const existing = (await db.from("shops").select("*").eq("owner_id", user.id).maybeSingle()).data as Record<string, unknown> | null;
  if (existing) {
    const slot = (await db.from("shop_slots").select("bazaar_id, slot_number").eq("id", existing.slot_id as string).maybeSingle()).data as { bazaar_id: string; slot_number: number } | null;
    const bazaar = bazaars.find((b) => b.id === slot?.bazaar_id) ?? bazaars[0];
    return toShop(existing, bazaar, slot?.slot_number ?? 1, ownerName);
  }

  // Find the first village with an open slot.
  for (const bazaar of bazaars) {
    const slots = (await db.from("shop_slots").select("id, slot_number").eq("bazaar_id", bazaar.id)).data as { id: string; slot_number: number }[] | null;
    if (!slots || slots.length === 0) continue;
    const slotIds = slots.map((s) => s.id);
    const taken = (await db.from("shops").select("slot_id").in("slot_id", slotIds)).data as { slot_id: string }[] | null;
    const takenIds = new Set((taken ?? []).map((t) => t.slot_id));
    const open = firstOpenSlotId(slots, takenIds);
    if (!open) continue;

    // Insert, retrying the (alpha-only, unique) address on collision.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const address = villageAddress(bazaar.slug, Date.now() + attempt);
      const { data, error } = await db
        .from("shops")
        .insert({ owner_id: user.id, slot_id: open.id, address, display_name: ownerName })
        .select("*")
        .single();
      if (!error && data) return toShop(data, bazaar, open.slot_number, ownerName);
      // 23505 = unique violation (address already taken) → retry a new address.
      if (error && (error as { code?: string }).code !== "23505") throw error;
    }
    throw new Error("Could not find a free address — please try again.");
  }
  throw new Error("All villages are full.");
}
