import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EventsRepository,
  HouseRepository,
  ProfileRepository,
  Repositories,
  ReportsRepository,
  RoomObjectRepository,
  RoomRepository,
} from "@/lib/repos/types";
import type { BazaarEvent, EventPayload, EventType, HouseRooms, Shop, UserProfile } from "@/lib/types";
import { eventLabels } from "@/lib/events";
import type { SessionUser } from "@/lib/auth/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { deriveDefaultHouse } from "@/lib/house";
import { handleFromName } from "@/lib/profile-store";
import { type RoomRow, houseFromRows, rowsFromHouse } from "@/lib/repos/supabase-mappers";

// Supabase repositories — Production Cutover V1 implements profiles, houses, and
// rooms (Tasks 2–4). Events/reports remain typed stubs (out of this sprint's
// scope). All access is via the anon client under RLS; no service role needed.

export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`${method} is not implemented yet — see docs/supabase-cutover.md.`);
    this.name = "NotImplementedError";
  }
}

const ROOM_COLS = "id, shop_id, client_id, name, type, description, theme, background, is_entry, objects";

function client(injected?: SupabaseClient | null): SupabaseClient {
  const resolved = injected ?? createSupabaseBrowserClient();
  if (!resolved) throw new Error("Supabase client unavailable — production repositories require Supabase env vars.");
  return resolved;
}

/** Resolve a shop's uuid id from its three-word address. */
async function shopIdByAddress(db: SupabaseClient, address: string): Promise<string | null> {
  const { data, error } = await db.from("shops").select("id").eq("address", address).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export class SupabaseProfileRepository implements ProfileRepository {
  private injected?: SupabaseClient | null;
  private resolved?: SupabaseClient;
  constructor(db?: SupabaseClient | null) {
    this.injected = db;
  }
  // Lazy: constructing a repo never requires env (so selection is testable);
  // the client is only required when a method actually runs.
  private get db(): SupabaseClient {
    return (this.resolved ??= client(this.injected));
  }

  private map(row: Record<string, unknown> | null): UserProfile | null {
    if (!row) return null;
    return {
      id: row.id as string,
      displayName: (row.display_name as string) ?? "Creator",
      username: (row.username as string | null) ?? undefined,
      avatarUrl: (row.avatar_url as string | null) ?? undefined,
      bio: (row.bio as string | null) ?? undefined,
      isAdmin: Boolean(row.is_admin),
    };
  }

  async getById(id: string) {
    const { data, error } = await this.db.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return this.map(data);
  }

  async ensureProfile(user: SessionUser): Promise<UserProfile> {
    const existing = await this.getById(user.id);
    if (existing) return existing;
    const insert = { id: user.id, display_name: user.name, username: handleFromName(user.name || user.email) };
    const { data, error } = await this.db.from("profiles").insert(insert).select("*").single();
    if (error) throw error;
    return this.map(data) as UserProfile;
  }

  async update(id: string, patch: Partial<Omit<UserProfile, "id" | "isAdmin">>) {
    const row: Record<string, unknown> = {};
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.username !== undefined) row.username = patch.username;
    if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
    if (patch.bio !== undefined) row.bio = patch.bio;
    row.updated_at = new Date().toISOString();
    const { data, error } = await this.db.from("profiles").update(row).eq("id", id).select("*").single();
    if (error) throw error;
    return this.map(data) as UserProfile;
  }

  // House aggregation for /u/[handle] is out of V1 scope (needs shops join).
  async getByHandle() {
    return null;
  }
}

export class SupabaseHouseRepository implements HouseRepository {
  private injected?: SupabaseClient | null;
  private resolved?: SupabaseClient;
  constructor(db?: SupabaseClient | null) {
    this.injected = db;
  }
  private get db(): SupabaseClient {
    return (this.resolved ??= client(this.injected));
  }

  async getStoredHouse(address: string): Promise<HouseRooms | null> {
    const shopId = await shopIdByAddress(this.db, address);
    if (!shopId) return null;
    const { data, error } = await this.db.from("rooms").select(ROOM_COLS).eq("shop_id", shopId);
    if (error) throw error;
    const rows = (data ?? []) as RoomRow[];
    if (rows.length === 0) return null;
    return houseFromRows(address, rows);
  }

  async getHouse(shop: Shop): Promise<HouseRooms> {
    return (await this.getStoredHouse(shop.address)) ?? deriveDefaultHouse(shop);
  }

  async saveHouse(house: HouseRooms): Promise<void> {
    const shopId = await shopIdByAddress(this.db, house.shopAddress);
    if (!shopId) throw new Error(`No shop found for address ${house.shopAddress} — claim the house first.`);
    const rows = rowsFromHouse(house, shopId);
    // Upsert the current rooms (keyed by shop_id + client_id)…
    const { error: upsertError } = await this.db.from("rooms").upsert(rows, { onConflict: "shop_id,client_id" });
    if (upsertError) throw upsertError;
    // …then remove any rooms that are no longer part of the house.
    const keep = rows.map((r) => r.client_id);
    const { error: deleteError } = await this.db
      .from("rooms")
      .delete()
      .eq("shop_id", shopId)
      .not("client_id", "in", `(${keep.map((k) => `"${k}"`).join(",")})`);
    if (deleteError) throw deleteError;
  }

  async resetHouse(address: string): Promise<void> {
    const shopId = await shopIdByAddress(this.db, address);
    if (!shopId) return;
    const { error } = await this.db.from("rooms").delete().eq("shop_id", shopId);
    if (error) throw error;
  }
}

export class SupabaseRoomRepository implements RoomRepository {
  private houses: SupabaseHouseRepository;
  constructor(db?: SupabaseClient | null) {
    this.houses = new SupabaseHouseRepository(db);
  }
  async listForHouse(address: string) {
    return (await this.houses.getStoredHouse(address))?.rooms ?? [];
  }
  async get(address: string, roomId: string) {
    const rooms = await this.listForHouse(address);
    return rooms.find((r) => r.id === roomId) ?? null;
  }
}

export class SupabaseRoomObjectRepository implements RoomObjectRepository {
  private rooms: SupabaseRoomRepository;
  constructor(db?: SupabaseClient | null) {
    this.rooms = new SupabaseRoomRepository(db);
  }
  async listForRoom(address: string, roomId: string) {
    return (await this.rooms.get(address, roomId))?.objects ?? [];
  }
}

const todo = (method: string): never => {
  throw new NotImplementedError(method);
};

type EventRow = {
  id: string;
  type: EventType;
  shop_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

/**
 * Durable analytics (Analytics + Discovery V1). Writes go through the
 * `record_event` RPC (anon-insertable under RLS); reads come back filtered by
 * RLS to the owner's own shop events (the "owners read own shop events" policy)
 * or all events for admins. Visitor/session ids + the client object id live in
 * the `events.metadata` jsonb so no schema column churn is needed.
 */
export class SupabaseEventsRepository implements EventsRepository {
  private injected?: SupabaseClient | null;
  private resolved?: SupabaseClient;
  constructor(db?: SupabaseClient | null) {
    this.injected = db;
  }
  private get db(): SupabaseClient {
    return (this.resolved ??= client(this.injected));
  }

  async record(type: EventType, payload: EventPayload = {}) {
    const metadata: Record<string, unknown> = { ...(payload.metadata ?? {}) };
    if (payload.targetId) metadata.targetId = payload.targetId;
    if (payload.visitorId) metadata.visitorId = payload.visitorId;
    if (payload.sessionId) metadata.sessionId = payload.sessionId;
    const { error } = await this.db.rpc("record_event", {
      p_type: type,
      p_shop_id: payload.shopId ?? null,
      p_metadata: metadata,
    });
    if (error) throw error;
  }

  async list(): Promise<BazaarEvent[]> {
    const { data, error } = await this.db
      .from("events")
      .select("id, type, shop_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw error;
    return ((data ?? []) as EventRow[]).map(mapEventRow);
  }

  async counts(): Promise<Record<EventType, number>> {
    const counts = Object.fromEntries(
      (Object.keys(eventLabels) as EventType[]).map((type) => [type, 0]),
    ) as Record<EventType, number>;
    const { data, error } = await this.db.from("event_counts").select("type, total");
    if (error) throw error;
    for (const row of (data ?? []) as { type: EventType; total: number | string }[]) {
      counts[row.type] = Number(row.total);
    }
    return counts;
  }
}

/** Pure row→BazaarEvent mapper (visitor/session/target ids unpacked from jsonb). */
export function mapEventRow(row: EventRow): BazaarEvent {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const { targetId, visitorId, sessionId, ...rest } = meta;
  return {
    id: row.id,
    type: row.type,
    shopId: row.shop_id ?? undefined,
    targetId: typeof targetId === "string" ? targetId : undefined,
    visitorId: typeof visitorId === "string" ? visitorId : undefined,
    sessionId: typeof sessionId === "string" ? sessionId : undefined,
    metadata: Object.keys(rest).length ? (rest as BazaarEvent["metadata"]) : undefined,
    createdAt: row.created_at,
  };
}

export class SupabaseReportsRepository implements ReportsRepository {
  list() {
    return todo("SupabaseReportsRepository.list");
  }
  file() {
    return todo("SupabaseReportsRepository.file");
  }
  setStatus() {
    return todo("SupabaseReportsRepository.setStatus");
  }
  hiddenRefs() {
    return todo("SupabaseReportsRepository.hiddenRefs");
  }
}

export function createSupabaseRepositories(): Repositories {
  return {
    houses: new SupabaseHouseRepository(),
    rooms: new SupabaseRoomRepository(),
    roomObjects: new SupabaseRoomObjectRepository(),
    profiles: new SupabaseProfileRepository(),
    events: new SupabaseEventsRepository(),
    reports: new SupabaseReportsRepository(),
  };
}
