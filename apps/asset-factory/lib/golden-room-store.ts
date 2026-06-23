// Golden Room — server-only local persistence (filesystem).
// Candidates survive across rounds in `.data/golden-room/` (gitignored): metadata in
// candidates.json, real PNGs in images/<id>.png. No Supabase dependency — this is a
// focused local art-direction tool. NEVER import from a client component.

import { promises as fs } from "node:fs";
import path from "node:path";
import { type GoldenRoomCandidate } from "@/lib/golden-room";

const DATA_DIR = path.join(process.cwd(), ".data", "golden-room");
const IMAGES_DIR = path.join(DATA_DIR, "images");
const CANDIDATES_FILE = path.join(DATA_DIR, "candidates.json");

async function ensureDirs(): Promise<void> {
  await fs.mkdir(IMAGES_DIR, { recursive: true });
}

/** Read all candidates (oldest-first). Returns [] if none yet. */
export async function readCandidates(): Promise<GoldenRoomCandidate[]> {
  try {
    const raw = await fs.readFile(CANDIDATES_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GoldenRoomCandidate[]) : [];
  } catch {
    return [];
  }
}

async function writeCandidates(list: GoldenRoomCandidate[]): Promise<void> {
  await ensureDirs();
  await fs.writeFile(CANDIDATES_FILE, JSON.stringify(list, null, 2), "utf8");
}

/** Append new candidates without losing existing ones. Returns the full list. */
export async function appendCandidates(newOnes: GoldenRoomCandidate[]): Promise<GoldenRoomCandidate[]> {
  const existing = await readCandidates();
  const merged = [...existing, ...newOnes];
  await writeCandidates(merged);
  return merged;
}

/** Patch one candidate (score/critique/status). Returns the updated candidate or null. */
export async function updateCandidate(
  id: string,
  patch: Partial<Pick<GoldenRoomCandidate, "score" | "critique" | "status">>,
): Promise<GoldenRoomCandidate | null> {
  const list = await readCandidates();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  await writeCandidates(list);
  return list[idx];
}

export async function getCandidate(id: string): Promise<GoldenRoomCandidate | null> {
  const list = await readCandidates();
  return list.find((c) => c.id === id) ?? null;
}

/** Save a PNG for a candidate (real generation). */
export async function saveImagePng(id: string, bytes: Uint8Array): Promise<void> {
  await ensureDirs();
  await fs.writeFile(path.join(IMAGES_DIR, `${safeId(id)}.png`), bytes);
}

/** Read a candidate PNG, or null if missing. */
export async function readImagePng(id: string): Promise<Uint8Array | null> {
  try {
    return await fs.readFile(path.join(IMAGES_DIR, `${safeId(id)}.png`));
  } catch {
    return null;
  }
}

/** Guard the id used in a filesystem path (ids are app-generated, but be safe). */
function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}
