import type {
  EventsRepository,
  HouseRepository,
  ProfileRepository,
  Repositories,
  ReportsRepository,
  RoomObjectRepository,
  RoomRepository,
} from "@/lib/repos/types";
// Supabase repositories — **stubs** for the backend cutover. The shapes are in
// place and selected when the app runs in production mode (Supabase env present),
// but the queries are not implemented yet: each method throws a clear, typed
// error so a premature cutover fails loudly rather than silently losing data.
// See docs/supabase-cutover.md for the migration/RLS plan these will satisfy.

export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`${method} is not implemented yet — Supabase backend cutover is pending (see docs/supabase-cutover.md).`);
    this.name = "NotImplementedError";
  }
}

const todo = (method: string): never => {
  throw new NotImplementedError(method);
};

export class SupabaseHouseRepository implements HouseRepository {
  getHouse() {
    return todo("SupabaseHouseRepository.getHouse");
  }
  getStoredHouse() {
    return todo("SupabaseHouseRepository.getStoredHouse");
  }
  saveHouse: HouseRepository["saveHouse"] = () => todo("SupabaseHouseRepository.saveHouse");
  resetHouse() {
    return todo("SupabaseHouseRepository.resetHouse");
  }
}

export class SupabaseRoomRepository implements RoomRepository {
  listForHouse() {
    return todo("SupabaseRoomRepository.listForHouse");
  }
  get() {
    return todo("SupabaseRoomRepository.get");
  }
}

export class SupabaseRoomObjectRepository implements RoomObjectRepository {
  listForRoom() {
    return todo("SupabaseRoomObjectRepository.listForRoom");
  }
}

export class SupabaseProfileRepository implements ProfileRepository {
  getByHandle() {
    return todo("SupabaseProfileRepository.getByHandle");
  }
}

export class SupabaseEventsRepository implements EventsRepository {
  record() {
    return todo("SupabaseEventsRepository.record");
  }
  list() {
    return todo("SupabaseEventsRepository.list");
  }
  counts() {
    return todo("SupabaseEventsRepository.counts");
  }
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
