// Golden Room — server-only local persistence (filesystem).
// Candidates survive across rounds: metadata in candidates.json, real PNGs in
// images/<id>.png. No Supabase dependency — this is a focused art-direction tool.
// NEVER import from a client component.
//
// Storage location:
//   - local dev:            apps/asset-factory/.data/golden-room  (gitignored)
//   - production/serverless: /tmp/nestudio-asset-factory/golden-room
// On Vercel (and other serverless runtimes) the bundle filesystem is READ-ONLY
// except for /tmp, so writing under the app dir throws ENOENT/EROFS.
//
// NOTE: /tmp is EPHEMERAL — it is wiped between cold starts and not shared across
// serverless instances. This is acceptable for now as temporary, non-durable storage
// for the Golden Room art-direction loop. Move to durable storage (Vercel Blob / S3 /
// Supabase Storage) before relying on candidates persisting in production.

import { promises as fs } from "node:fs";
import path from "node:path";
import { type GoldenRoomCandidate } from "@/lib/golden-room";

/** Serverless runtimes (Vercel, AWS Lambda) allow writes only under /tmp. */
function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

const DATA_DIR = isServerless()
  ? path.join("/tmp", "nestudio-asset-factory", "golden-room")
  : path.join(process.cwd(), ".data", "golden-room");
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
