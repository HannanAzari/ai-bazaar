import type { GuestbookEntry } from "@/lib/types";

// Demo guestbook. Entries live in localStorage keyed by house address so the
// panel works without a backend; production writes the same shape to the
// Supabase `guestbook_entries` table (see schema.sql).

const STORAGE_KEY = "ai-bazaar-guestbook";

type Store = Record<string, GuestbookEntry[]>;

function readAll(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function writeAll(store: Store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event("ai-bazaar-guestbook-changed"));
}

/** Entries for a house, newest first. Hidden entries are included (owner view filters). */
export function getEntries(address: string): GuestbookEntry[] {
  return (readAll()[address] ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addEntry(address: string, input: { name: string; message: string }): GuestbookEntry {
  const entry: GuestbookEntry = {
    id: `gb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    shopAddress: address,
    name: input.name.trim().slice(0, 40) || "A visitor",
    message: input.message.trim().slice(0, 240),
    hidden: false,
    createdAt: new Date().toISOString(),
  };
  const store = readAll();
  store[address] = [entry, ...(store[address] ?? [])];
  writeAll(store);
  return entry;
}

export function setEntryHidden(address: string, id: string, hidden: boolean) {
  const store = readAll();
  store[address] = (store[address] ?? []).map((entry) => (entry.id === id ? { ...entry, hidden } : entry));
  writeAll(store);
}

export function deleteEntry(address: string, id: string) {
  const store = readAll();
  store[address] = (store[address] ?? []).filter((entry) => entry.id !== id);
  writeAll(store);
}
