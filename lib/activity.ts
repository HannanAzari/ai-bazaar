import type { ActivityEntry, ActivityType } from "@/lib/types";

// Demo activity feed. Stored in localStorage so the feed works without a
// backend; production writes the same shape to the Supabase `activity_events`
// table (see schema.sql). Only public, tasteful events are recorded.

const STORAGE_KEY = "ai-bazaar-activity";
const SEEDED_KEY = "ai-bazaar-activity-seeded";
const MAX = 300;

export const activityLabels: Record<ActivityType, string> = {
  claimed_house: "claimed a house",
  updated_house: "updated their house",
  added_decoration: "added a decoration",
  liked_house: "liked a house",
  followed_creator: "followed a creator",
  guestbook_entry: "signed a guestbook",
  saved_to_collection: "saved to a collection",
};

function read(): ActivityEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as ActivityEntry[];
  } catch {
    return [];
  }
}

function write(entries: ActivityEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX)));
  window.dispatchEvent(new Event("ai-bazaar-activity-changed"));
}

export function getActivity(): ActivityEntry[] {
  return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Activity by a single creator handle (bare, no @). */
export function getActivityForHandle(handle: string): ActivityEntry[] {
  const target = handle.replace(/^@/, "").toLowerCase();
  return getActivity().filter((entry) => entry.actorHandle.toLowerCase() === target);
}

export function recordActivity(input: {
  type: ActivityType;
  actorName: string;
  actorHandle: string;
  summary: string;
  href?: string;
}): void {
  if (typeof window === "undefined") return;
  const entry: ActivityEntry = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    ...input,
    actorHandle: input.actorHandle.replace(/^@/, ""),
  };
  write([entry, ...read()]);
}

/** Populate a lively starter feed once, so the page is not empty in the demo. */
export function seedDemoActivity() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(SEEDED_KEY)) return;
  window.localStorage.setItem(SEEDED_KEY, "true");
  if (read().length > 0) return;

  const now = Date.now();
  const at = (m: number) => new Date(now - m * 60_000).toISOString();
  const samples: ActivityEntry[] = [
    { id: "act-seed-1", type: "added_decoration", actorName: "Mina Farah", actorHandle: "minamakes", summary: "added a decoration to The Quiet Kettle", href: "/shop/saffron.tiny.lantern", createdAt: at(12) },
    { id: "act-seed-2", type: "followed_creator", actorName: "Theo Vale", actorHandle: "theovale", summary: "followed Amal Noor", href: "/u/amalafterlight", createdAt: at(34) },
    { id: "act-seed-3", type: "guestbook_entry", actorName: "Jun Park", actorHandle: "junfolds", summary: "signed the guestbook at Blue Hour Studio", href: "/shop/moon.blue.hour", createdAt: at(58) },
    { id: "act-seed-4", type: "liked_house", actorName: "Inez Cole", actorHandle: "inezoutside", summary: "liked Paper Cloud", href: "/shop/rose.paper.cloud", createdAt: at(96) },
    { id: "act-seed-5", type: "updated_house", actorName: "Amal Noor", actorHandle: "amalafterlight", summary: "updated Blue Hour Studio", href: "/shop/moon.blue.hour", createdAt: at(140) },
    { id: "act-seed-6", type: "claimed_house", actorName: "Lina Cho", actorHandle: "linaprints", summary: "claimed a house in Paper Meadow", href: "/shop/paper.peach.press", createdAt: at(220) },
  ];
  write(samples);
}
