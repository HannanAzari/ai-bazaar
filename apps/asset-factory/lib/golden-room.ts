// Golden Room — pure logic (no I/O, no secrets, no client/server coupling).
// The art-direction "discover ONE room" system: prompts, rubric, candidate model,
// winner rule, and the RoomShellPack export. Server modules + the API route + the
// UI all build on this. Unit-tested in test/golden-room.test.ts.

export type GoldenRoomStatus = "pending" | "approved" | "rejected";

export type GoldenRoomCandidate = {
  id: string;
  round: number;
  imageUrl: string; // "/api/golden-room/image/<id>" (real) or a data: URL (dry run)
  prompt: string;
  negativePrompt: string;
  /** 0–100 overall art-director score, or null until scored. */
  score: number | null;
  critique: string;
  status: GoldenRoomStatus;
  dryRun: boolean;
  createdAt: string; // ISO
};

export type SceneArea = {
  id: string;
  recommendedFor: string[];
  bounds: { x: number; y: number; width: number; height: number };
};

export type RoomShellPackExport = {
  id: string;
  type: "room_shell_pack";
  imageUrl: string;
  version: string;
  styleFamily: string;
  sceneAreas: SceneArea[];
};

/** Winner bar (the brief): 85+ to win; anything below 80 is not good enough. */
export const WINNER_THRESHOLD = 85;
export const NOT_GOOD_ENOUGH_BELOW = 80;
/** Art-director discipline: never batch — max 5 candidates per round. */
export const MAX_PER_ROUND = 5;

export const GOLDEN_ROOM_STYLE_FAMILY = "nestudio-golden-room";

/** The 7-criterion scoring rubric (the overall `score` is the art director's holistic 0–100). */
export const GOLDEN_ROOM_RUBRIC: { id: string; label: string; hint: string }[] = [
  { id: "emotional_pull", label: "Emotional pull", hint: "Does it make me want to enter the room?" },
  { id: "nestudio_dna", label: "Nestudio DNA", hint: "Warm, premium, handcrafted, magical?" },
  { id: "mobile_readability", label: "Mobile readability", hint: "Works at phone size?" },
  { id: "scene_capacity", label: "Scene capacity", hint: "Supports YouTube/GitHub/Spotify/portfolio/bio/achievements?" },
  { id: "rwo_flow", label: "Room → Wall → Object flow", hint: "Can a user tap areas and zoom into front scenes?" },
  { id: "lived_in", label: "Believable home feeling", hint: "Lived-in, not staged?" },
  { id: "technical", label: "Technical usability", hint: "Can we overlay hotspots / scene metadata?" },
];

/** Anchor prompt (from docs/golden-room-exploration.md, Rounds 2–5). Round 1 starting point. */
export const GOLDEN_ROOM_PROMPT = [
  "A cozy premium isometric \"dollhouse cutaway\" living room that already feels lived-in — like",
  "someone's warm home, not a showroom. Three-quarter isometric view at roughly a 30-degree",
  "downward angle with PARALLEL projection (no vanishing point), the whole room centred and fully",
  "in frame, portrait composition, mobile-first. Warm storybook-premium style: soft rounded",
  "architecture, premium matte materials, warm oiled-oak plank floor with gentle wear, a soft rug,",
  "a plump sofa with a throw cushion, a low coffee table with a couple of books, a leafy plant, a",
  "warm glowing floor lamp, a small desk / work corner, a shelf. Soft warm daylight from an",
  "upper-left window with gentle cool-toned ambient shadow; calm, golden, inhabited atmosphere with",
  "believable depth and soft contact shadows. The back wall and one side wall have CLEAN, NEUTRAL",
  "empty areas (warm plaster, a simple picture rail) where future creator scenes will go — no",
  "pictures, no screens, no posters in those areas. Cohesive Nestudio world: warm, rounded, matte,",
  "one calm accent. Believable, not empty, not staged, not minimalist, not luxury.",
].join(" ");

/** Scene-pack negative prompt (base + Golden-Room additions). OpenAI folds this into the prompt. */
export const GOLDEN_ROOM_NEGATIVE = [
  "photorealism", "realistic photography", "generic AI interior", "interior-design render",
  "architectural rendering", "showroom", "pinterest", "ikea catalogue", "furniture catalogue",
  "luxury mansion", "minimalist architecture", "empty room", "staged", "cluttered", "dashboard",
  "linktree", "game UI", "hud", "isometric tilemap", "one-point perspective", "two-point perspective",
  "vanishing point", "top-down", "fisheye", "tilted horizon", "warped walls", "distorted furniture",
  "perspective mismatch", "text", "words", "letters", "watermark", "logo", "signage", "posters",
  "framed photos of people", "screens showing content", "brand", "people", "neon",
  "dramatic lighting", "hard shadows", "sunset", "night", "dark gamer room", "cold lighting", "grey",
  "flat vector", "flat cartoon", "clipart", "sticker", "cartoon outline", "obvious AI artifacts",
].join(", ");

/**
 * Scene areas for the export (the brief's four areas). Bounds are normalized
 * placeholders from docs/golden-room-v1.md §6 — recalibrate against the final image.
 */
export const GOLDEN_ROOM_SCENE_AREAS: SceneArea[] = [
  { id: "media-area", recommendedFor: ["youtube", "video", "twitch"], bounds: { x: 0.17, y: 0.27, width: 0.2, height: 0.18 } },
  { id: "work-area", recommendedFor: ["github", "website", "blog"], bounds: { x: 0.876, y: 0.38, width: 0.124, height: 0.26 } },
  { id: "gallery-area", recommendedFor: ["instagram", "portfolio", "art"], bounds: { x: 0.41, y: 0.26, width: 0.2, height: 0.2 } },
  { id: "achievement-area", recommendedFor: ["awards", "milestones", "press"], bounds: { x: 0.65, y: 0.27, width: 0.19, height: 0.18 } },
];

/** Clamp a requested candidate count to [1, MAX_PER_ROUND]. */
export function clampCount(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(MAX_PER_ROUND, Math.floor(n)));
}

/** Validate/normalize an overall score: null, or an integer 0–100. */
export function normalizeScore(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function isGoldenRoomStatus(value: unknown): value is GoldenRoomStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

/** A winner is approved AND scored at or above the bar. */
export function isWinner(c: Pick<GoldenRoomCandidate, "status" | "score">): boolean {
  return c.status === "approved" && c.score !== null && c.score >= WINNER_THRESHOLD;
}

/** The strongest current candidate (highest score; approved breaks ties), or null. */
export function bestCandidate(list: GoldenRoomCandidate[]): GoldenRoomCandidate | null {
  const scored = list.filter((c) => c.score !== null);
  if (scored.length === 0) return null;
  return [...scored].sort((a, b) => {
    const s = (b.score ?? 0) - (a.score ?? 0);
    if (s !== 0) return s;
    return Number(isWinner(b)) - Number(isWinner(a));
  })[0];
}

/** The next round number to generate (max existing round + 1, else 1). */
export function nextRound(list: GoldenRoomCandidate[]): number {
  return list.reduce((max, c) => Math.max(max, c.round), 0) + 1;
}

/** Build the RoomShellPack export JSON for a chosen candidate. */
export function buildRoomShellPackExport(c: GoldenRoomCandidate): RoomShellPackExport {
  return {
    id: "golden-room-v1",
    type: "room_shell_pack",
    imageUrl: c.imageUrl,
    version: "1.0.0",
    styleFamily: GOLDEN_ROOM_STYLE_FAMILY,
    sceneAreas: GOLDEN_ROOM_SCENE_AREAS,
  };
}
