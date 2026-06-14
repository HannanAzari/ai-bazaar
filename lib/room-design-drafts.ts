import type { Room } from "@/lib/types";
import type { DesignStyle, ParsedBrief } from "@/lib/ai-room-designer";

// Demo store for AI Room Designer drafts. A draft is a saved, un-applied design
// (the generated Room plus the brief/style/intent/constraints that produced it),
// so an owner can compare options and apply one later. Stored in localStorage
// keyed by house address; production writes the same shape to the Supabase
// `room_design_drafts` table (owner-private; see schema.sql). Mirrors the
// SSR-guarded read/write + `*-changed` event pattern of lib/collections.ts.

const STORAGE_KEY = "ai-bazaar-design-drafts";

export type RoomDesignDraft = {
  id: string;
  /** The house this draft belongs to. */
  shopAddress: string;
  /** Display name (defaults to the generated room's name). */
  name: string;
  /** The brief that produced the design. */
  brief: string;
  style: DesignStyle;
  /** Matched design intent id (e.g. "photography"). */
  intentId: string;
  /** The structured brief: creator type · mood · purpose · constraints. */
  parsed: ParsedBrief;
  /** The full generated room, ready to apply. */
  room: Room;
  createdAt: string;
};

type Store = Record<string, RoomDesignDraft[]>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event("ai-bazaar-design-drafts-changed"));
}

/** Drafts for a house, newest first. */
export function getDrafts(address: string): RoomDesignDraft[] {
  return (read()[address] ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Persist a new draft and return it. */
export function saveDraft(input: Omit<RoomDesignDraft, "id" | "createdAt">): RoomDesignDraft {
  const draft: RoomDesignDraft = {
    ...input,
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  const store = read();
  store[draft.shopAddress] = [...(store[draft.shopAddress] ?? []), draft];
  write(store);
  return draft;
}

/** A single draft by id (searches every house). */
export function getDraft(id: string): RoomDesignDraft | null {
  for (const drafts of Object.values(read())) {
    const found = drafts.find((d) => d.id === id);
    if (found) return found;
  }
  return null;
}

export function deleteDraft(address: string, id: string) {
  const store = read();
  const drafts = store[address];
  if (!drafts) return;
  store[address] = drafts.filter((d) => d.id !== id);
  write(store);
}
