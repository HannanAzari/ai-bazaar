import type {
  EventsRepository,
  HouseRepository,
  ProfileRepository,
  Repositories,
  ReportInput,
  ReportsRepository,
  RoomObjectRepository,
  RoomRepository,
} from "@/lib/repos/types";
import type { EventPayload, EventType, ReportStatus, Shop, UserProfile } from "@/lib/types";
import type { SessionUser } from "@/lib/auth/types";
import { getHouse, getStoredHouse, resetHouse, saveHouse } from "@/lib/room";
import { eventCounts, getEvents, trackEventLocal } from "@/lib/events";
import { fileReport, getReports, hiddenRefs, setReportStatus } from "@/lib/reports";
import { getCreator } from "@/lib/creators";
import { ensureProfile, getProfile, updateProfile } from "@/lib/profile-store";
import { shops } from "@/lib/data";

// Local (demo) repositories — thin async wrappers over the existing localStorage
// libs. They change no behaviour: the libs remain the implementation, repos are
// just the cutover-ready seam in front of them.

const ok = <T>(value: T): Promise<T> => Promise.resolve(value);

export class LocalHouseRepository implements HouseRepository {
  getHouse(shop: Shop) {
    return ok(getHouse(shop));
  }
  getStoredHouse(address: string) {
    return ok(getStoredHouse(address));
  }
  saveHouse: HouseRepository["saveHouse"] = (house) => {
    saveHouse(house);
    return ok(undefined);
  };
  resetHouse(address: string) {
    resetHouse(address);
    return ok(undefined);
  }
}

export class LocalRoomRepository implements RoomRepository {
  async listForHouse(address: string) {
    return getStoredHouse(address)?.rooms ?? [];
  }
  async get(address: string, roomId: string) {
    return getStoredHouse(address)?.rooms.find((room) => room.id === roomId) ?? null;
  }
}

export class LocalRoomObjectRepository implements RoomObjectRepository {
  async listForRoom(address: string, roomId: string) {
    const room = getStoredHouse(address)?.rooms.find((r) => r.id === roomId);
    return room?.objects ?? [];
  }
}

export class LocalProfileRepository implements ProfileRepository {
  async getByHandle(handle: string) {
    return getCreator(shops, handle);
  }
  async getById(id: string) {
    return getProfile(id);
  }
  async ensureProfile(user: SessionUser): Promise<UserProfile> {
    return ensureProfile(user);
  }
  async update(id: string, patch: Partial<Omit<UserProfile, "id" | "isAdmin">>) {
    return updateProfile(id, patch);
  }
}

export class LocalEventsRepository implements EventsRepository {
  record(type: EventType, payload?: EventPayload) {
    trackEventLocal(type, payload);
    return ok(undefined);
  }
  list() {
    return ok(getEvents());
  }
  counts() {
    return ok(eventCounts());
  }
}

export class LocalReportsRepository implements ReportsRepository {
  list() {
    return ok(getReports());
  }
  file(input: ReportInput) {
    return ok(fileReport(input));
  }
  setStatus(id: string, status: ReportStatus) {
    setReportStatus(id, status);
    return ok(undefined);
  }
  hiddenRefs() {
    return ok(hiddenRefs());
  }
}

export function createLocalRepositories(): Repositories {
  return {
    houses: new LocalHouseRepository(),
    rooms: new LocalRoomRepository(),
    roomObjects: new LocalRoomObjectRepository(),
    profiles: new LocalProfileRepository(),
    events: new LocalEventsRepository(),
    reports: new LocalReportsRepository(),
  };
}
