import type { HouseRooms, Shop } from "@/lib/types";
import { getRepositories } from "@/lib/repos";

// Async house persistence seam. Components call these instead of lib/room.ts
// directly, so the repository factory (runtime mode) decides where rooms live:
// localStorage in demo, Supabase in production. In demo the local repo delegates
// to the exact same lib/room.ts functions, so behaviour is byte-for-byte identical.

export function loadHouse(shop: Shop): Promise<HouseRooms> {
  return getRepositories().houses.getHouse(shop);
}

export function loadStoredHouse(address: string): Promise<HouseRooms | null> {
  return getRepositories().houses.getStoredHouse(address);
}

export function persistHouse(house: HouseRooms): Promise<void> {
  return getRepositories().houses.saveHouse(house);
}

export function forgetHouse(address: string): Promise<void> {
  return getRepositories().houses.resetHouse(address);
}
