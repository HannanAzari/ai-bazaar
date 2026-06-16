import type { BazaarEvent, EventPayload, EventType } from "@/lib/types";
import { isProductionBackend } from "@/lib/runtime-mode";
import { readSessionId, readVisitorId } from "@/lib/visitor-id";

// Analytics. `trackEvent` is **mode-aware** (Analytics + Discovery V1):
//   - demo:       events append to localStorage (offline, per-browser) — unchanged.
//   - production: events are written durably to Supabase via the events repository
//     (record_event RPC), so they survive refresh, logout, and device change. A
//     remote failure falls back to the local mirror so nothing is silently lost.
// Every event is automatically enriched with the current anonymous visitor +
// session ids (lib/visitor-id.ts) so unique-visitor and session metrics work
// without each call site threading them through.

const STORAGE_KEY = "ai-bazaar-events";
const MAX_EVENTS = 1000;

export const eventLabels: Record<EventType, string> = {
  house_view: "House views",
  room_view: "Room views",
  decoration_click: "Decoration clicks",
  object_click: "Object clicks",
  link_click: "Link clicks",
  share_click: "Shares",
  follow: "Follows",
  like: "Likes",
  room_object_added: "Objects added",
  room_object_deleted: "Objects deleted",
  room_object_moved: "Objects moved",
  room_object_resized: "Objects resized",
  room_template_applied: "Templates applied",
  gallery_opened: "Galleries opened",
  video_opened: "Videos opened",
  product_opened: "Products opened",
  booking_opened: "Bookings opened",
  contact_opened: "Contacts opened",
  profile_opened: "Profiles opened",
  room_entered: "Rooms entered",
  room_created: "Rooms created",
  room_deleted: "Rooms deleted",
  room_link_clicked: "Door/stair clicks",
  room_design_generated: "AI designs generated",
  room_design_applied: "AI designs applied",
  room_design_regenerated: "AI designs regenerated",
  room_design_draft_saved: "AI drafts saved",
  room_design_draft_applied: "AI drafts applied",
  room_design_constraint_detected: "AI constraints detected",
  room_design_preset_used: "AI presets used",
  creator_profile_analyzed: "Creator profiles analyzed",
  creator_room_generated: "Creator rooms generated",
  creator_room_applied: "Creator rooms applied",
  creator_social_object_created: "Creator social objects created",
  signup_completed: "Signups completed",
  onboarding_completed: "Onboardings completed",
  first_nest_created: "First Nests created",
  room_saved: "Rooms saved",
  session_started: "Visitor sessions started",
  session_ended: "Visitor sessions ended",
  object_view: "Object views",
};

function read(): BazaarEvent[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as BazaarEvent[];
  } catch {
    return [];
  }
}

function write(events: BazaarEvent[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  window.dispatchEvent(new Event("ai-bazaar-events-changed"));
}

function toEvent(type: EventType, payload: EventPayload): BazaarEvent {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    shopId: payload.shopId,
    targetId: payload.targetId,
    visitorId: payload.visitorId,
    sessionId: payload.sessionId,
    metadata: payload.metadata,
    createdAt: new Date().toISOString(),
  };
}

/** Append one event to the local (demo) store. No-op during SSR. The demo path
 * and the production fallback both go through here. */
export function trackEventLocal(type: EventType, payload: EventPayload = {}) {
  if (typeof window === "undefined") return;
  write([...read(), toEvent(type, payload)]);
}

// Once the durable backend is unreachable we keep mirroring locally so nothing
// is lost, but log only the first failure to avoid flooding the console.
let remoteFailureLogged = false;

/** Record one analytics event through the mode-selected backend. No-op in SSR. */
export function trackEvent(type: EventType, payload: EventPayload = {}) {
  if (typeof window === "undefined") return;
  const enriched: EventPayload = {
    ...payload,
    visitorId: payload.visitorId ?? readVisitorId(),
    sessionId: payload.sessionId ?? readSessionId(),
  };
  if (isProductionBackend()) {
    void recordRemote(type, enriched).catch((err) => {
      if (!remoteFailureLogged) {
        remoteFailureLogged = true;
        console.warn("[analytics] durable record failed; mirroring events locally for this session", err);
      }
      trackEventLocal(type, enriched);
    });
    return;
  }
  trackEventLocal(type, enriched);
}

// Dynamically imported so the Supabase client never bundles into the demo path
// and there is no static import cycle (repos → events).
async function recordRemote(type: EventType, payload: EventPayload) {
  const { getRepositories } = await import("@/lib/repos");
  await getRepositories().events.record(type, payload);
}

export function getEvents(): BazaarEvent[] {
  return read();
}

/** Totals per event type, including zeroes, in display order. */
export function eventCounts(): Record<EventType, number> {
  const counts = Object.fromEntries(
    (Object.keys(eventLabels) as EventType[]).map((type) => [type, 0]),
  ) as Record<EventType, number>;
  for (const event of read()) counts[event.type] = (counts[event.type] ?? 0) + 1;
  return counts;
}
