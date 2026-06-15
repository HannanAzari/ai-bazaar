import type {
  BazaarEvent,
  EventType,
  HouseRooms,
  Report,
  ReportStatus,
  ReportTargetType,
  Room,
  RoomObject,
  Shop,
  UserProfile,
} from "@/lib/types";
import type { Creator } from "@/lib/creators";
import type { SessionUser } from "@/lib/auth/types";

// Repository layer — the seam for the demo → Supabase cutover.
//
// Every method is **async** (Promise-returning) so the same interface fits both
// the synchronous localStorage demo (wrapped in Promise.resolve) and a real
// Supabase backend (network I/O). The app keeps using the demo libs directly
// today; these interfaces document the contract production must satisfy, and the
// factory in lib/repos/index.ts selects an implementation by runtime mode.

export interface HouseRepository {
  /** The house to render: saved layout, else a derived default. */
  getHouse(shop: Shop): Promise<HouseRooms>;
  /** The saved house for an address, or null if never edited. */
  getStoredHouse(address: string): Promise<HouseRooms | null>;
  saveHouse(house: HouseRooms): Promise<void>;
  /** Forget the saved house so it reverts to its derived default. */
  resetHouse(address: string): Promise<void>;
}

export interface RoomRepository {
  /** All rooms in a house (empty if the house has never been saved). */
  listForHouse(address: string): Promise<Room[]>;
  /** A single room by id within a house. */
  get(address: string, roomId: string): Promise<Room | null>;
}

export interface RoomObjectRepository {
  /** Objects placed in a given room. */
  listForRoom(address: string, roomId: string): Promise<RoomObject[]>;
}

export interface ProfileRepository {
  /** A creator (aggregated from their houses) by handle. */
  getByHandle(handle: string): Promise<Creator | null>;
  /** The auth-linked profile for a user id, or null if none yet. */
  getById(id: string): Promise<UserProfile | null>;
  /** Create the profile on first login if absent, returning the current one. */
  ensureProfile(user: SessionUser): Promise<UserProfile>;
  /** Patch mutable profile fields. */
  update(id: string, patch: Partial<Omit<UserProfile, "id" | "isAdmin">>): Promise<UserProfile>;
}

export interface EventsRepository {
  record(type: EventType, payload?: { shopId?: string; targetId?: string }): Promise<void>;
  list(): Promise<BazaarEvent[]>;
  counts(): Promise<Record<EventType, number>>;
}

export interface ReportInput {
  targetType: ReportTargetType;
  targetRef: string;
  targetLabel: string;
  reason: string;
  targetId?: string;
}

export interface ReportsRepository {
  list(): Promise<Report[]>;
  file(input: ReportInput): Promise<Report>;
  setStatus(id: string, status: ReportStatus): Promise<void>;
  /** Refs (addresses/handles) hidden by moderation. */
  hiddenRefs(): Promise<Set<string>>;
}

/** The full set of repositories the app talks to. */
export interface Repositories {
  houses: HouseRepository;
  rooms: RoomRepository;
  roomObjects: RoomObjectRepository;
  profiles: ProfileRepository;
  events: EventsRepository;
  reports: ReportsRepository;
}
