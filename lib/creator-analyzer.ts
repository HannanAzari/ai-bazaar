import type { CreatorType, DesignResult, Mood, Purpose } from "@/lib/ai-room-designer";
import {
  creatorTypeLabels,
  generateRoomDesign,
  intentLabelForCreatorType,
  moodLabels,
  parseBrief,
  purposeLabels,
} from "@/lib/ai-room-designer";
import { getAsset } from "@/lib/assets";
import { addObjectFromAsset } from "@/lib/room-schema";
import type { Room } from "@/lib/types";

// ── Creator Auto Build (AI Room Designer V3) ─────────────────────────────────
//
// DETERMINISTIC profile analysis — it does NOT scrape the internet, call any API,
// or generate images. It reads signals straight from the *strings* a creator
// provides (social URLs, usernames, domain names, optional bio), maps them to the
// existing designer vocabulary, and composes a standard Room via the existing
// AI Room Designer (ADR-006/015/016, room-engine-spec §11). Identical input always
// produces the identical analysis and room.

export type SocialPlatform = "instagram" | "tiktok" | "youtube" | "website";

export type CreatorSocialLink = {
  platform: SocialPlatform;
  label: string;
  url: string;
  username?: string;
};

export type CreatorAnalyzerInput = {
  instagramUrl?: string;
  tiktokUrl?: string;
  youtubeUrl?: string;
  websiteUrl?: string;
  bio?: string;
};

export type CreatorAnalysis = {
  creatorType: CreatorType;
  mood: Mood;
  purpose: Purpose;
  keywords: string[];
  socialLinks: CreatorSocialLink[];
  /** 0..1 confidence in the analysis, from how many signals were supplied. */
  confidence: number;
  summary: string;
};

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  website: "Website",
};

const STOPWORDS = new Set([
  "the", "and", "for", "with", "your", "you", "our", "are", "this", "that", "from",
  "www", "com", "net", "org", "official", "real", "the_", "http", "https",
]);

/** Parse a possibly-bare URL string into a URL, or null. Pure. */
function safeUrl(raw?: string): URL | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProto);
  } catch {
    return null;
  }
}

/** Split an identifier into lowercase words (camelCase + separators), len ≥ 3. */
function splitWords(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

/** The first path segment of a social URL (sans leading @), e.g. the handle. */
export function extractUsername(raw: string | undefined, platform: SocialPlatform): string | undefined {
  if (platform === "website") return undefined;
  const url = safeUrl(raw);
  if (!url) return undefined;
  const seg = url.pathname.split("/").filter(Boolean)[0];
  if (!seg) return undefined;
  return seg.replace(/^@/, "") || undefined;
}

/** Significant words from a URL's domain (drops the TLD + www), e.g. "jane-photo.com" → ["jane","photo"]. */
export function domainWords(raw: string | undefined): string[] {
  const url = safeUrl(raw);
  if (!url) return [];
  const host = url.hostname.replace(/^www\./, "");
  const name = host.split(".")[0] ?? "";
  return splitWords(name);
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

function inferTypeFromPlatforms(links: CreatorSocialLink[]): CreatorType | undefined {
  const has = (p: SocialPlatform) => links.some((l) => l.platform === p);
  if (has("youtube")) return "podcaster";
  if (has("instagram")) return "photographer";
  if (has("tiktok")) return "personal";
  return undefined;
}

function inferPurpose(type: CreatorType, links: CreatorSocialLink[]): Purpose {
  if (type === "shop_owner" || type === "small_business") return "selling";
  if (type === "photographer" || type === "artist" || type === "designer") return "portfolio";
  if (type === "coach" || type === "consultant") return "booking";
  if (links.some((l) => l.platform === "youtube")) return "storytelling";
  return "personal_profile";
}

function purposeBlurb(purpose: Purpose): string {
  switch (purpose) {
    case "portfolio": return "sharing their work";
    case "booking": return "taking bookings";
    case "selling": return "selling their work";
    case "storytelling": return "telling their story";
    case "community": return "building a community";
    case "gallery": return "showcasing their work";
    default: return "sharing who they are";
  }
}

function purposePhrase(purpose: Purpose): string {
  switch (purpose) {
    case "portfolio": return "share my work";
    case "booking": return "take bookings";
    case "selling": return "sell my work";
    case "storytelling": return "tell my story";
    case "community": return "welcome visitors";
    case "gallery": return "showcase my work";
    default: return "share who I am";
  }
}

function computeConfidence(input: CreatorAnalyzerInput, hasKeywordType: boolean, hasKeywordPurpose: boolean, socialCount: number): number {
  let c = Math.min(socialCount, 4) * 0.15; // up to 0.60 from links
  if (input.bio && input.bio.trim().length >= 10) c += 0.2;
  if (hasKeywordType) c += 0.15; // an explicit keyword signal beats a platform guess
  if (hasKeywordPurpose) c += 0.05;
  return Math.round(Math.min(c, 1) * 100) / 100;
}

/**
 * Analyze a set of social URLs + an optional bio into the designer's vocabulary.
 * Pure and deterministic; never fetches anything.
 */
export function analyzeCreator(input: CreatorAnalyzerInput): CreatorAnalysis {
  const socialLinks: CreatorSocialLink[] = [];
  const add = (platform: SocialPlatform, raw?: string) => {
    const url = safeUrl(raw);
    if (!url) return;
    socialLinks.push({ platform, label: PLATFORM_LABEL[platform], url: url.toString(), username: extractUsername(raw, platform) });
  };
  add("instagram", input.instagramUrl);
  add("tiktok", input.tiktokUrl);
  add("youtube", input.youtubeUrl);
  add("website", input.websiteUrl);

  const usernameWords = socialLinks.flatMap((l) => (l.username ? splitWords(l.username) : []));
  const domainWordList = [input.instagramUrl, input.tiktokUrl, input.youtubeUrl, input.websiteUrl].flatMap(domainWords);
  const bioWords = input.bio ? splitWords(input.bio) : [];
  const corpus = [input.bio ?? "", ...usernameWords, ...domainWordList].join(" ").trim();

  const parsed = parseBrief(corpus);

  const creatorType: CreatorType = parsed.creatorType ?? inferTypeFromPlatforms(socialLinks) ?? "personal";
  const mood: Mood = parsed.mood ?? "warm";
  const purpose: Purpose = parsed.purpose ?? inferPurpose(creatorType, socialLinks);

  const keywords = uniq([...bioWords, ...usernameWords, ...domainWordList]).slice(0, 10);
  const confidence = computeConfidence(input, Boolean(parsed.creatorType), Boolean(parsed.purpose), socialLinks.length);
  const summary = `A ${creatorTypeLabels[creatorType].toLowerCase()} ${purposeBlurb(purpose)}.`;

  return { creatorType, mood, purpose, keywords, socialLinks, confidence, summary };
}

/** A deterministic welcome line for `room.description`. */
export function welcomeMessage(analysis: CreatorAnalysis): string {
  return `Welcome to my ${intentLabelForCreatorType(analysis.creatorType)} where I ${purposePhrase(analysis.purpose)}.`;
}

/** A brief that re-encodes the analysis so generateRoomDesign detects the same dimensions. */
function buildBrief(analysis: CreatorAnalysis): string {
  return [
    creatorTypeLabels[analysis.creatorType],
    moodLabels[analysis.mood],
    purposeLabels[analysis.purpose],
    analysis.keywords.join(" "),
  ].join(" ").trim();
}

export type CreatorRoomResult = {
  analysis: CreatorAnalysis;
  /** A DesignResult the existing preview / draft / apply UI can consume. */
  result: DesignResult;
  welcome: string;
  /** Number of per-platform social objects actually placed. */
  socialObjects: number;
  profileCreated: boolean;
};

// How many of the base design's objects to keep before adding profile + socials,
// so there's zone capacity for the auto objects.
const BASE_OBJECT_BUDGET = 3;

/**
 * Build a complete creator room from social profiles: the base design (via the
 * existing AI Room Designer) trimmed to leave room, plus an auto profile object
 * and one link object per supplied platform, plus a welcome `description`.
 * Deterministic; nothing is persisted.
 */
export function generateCreatorRoom(input: CreatorAnalyzerInput, address: string, variant = 0): CreatorRoomResult {
  const analysis = analyzeCreator(input);
  const base = generateRoomDesign({ brief: buildBrief(analysis), address, variant });

  // Trim the base so the auto objects have somewhere to go.
  let room: Room = { ...base.room, objects: base.room.objects.slice(0, BASE_OBJECT_BUDGET) };

  // Auto profile object — populated with the detected title, summary, and links.
  const portrait = getAsset("ast-avatar-portrait");
  let profileCreated = false;
  if (portrait) {
    const before = room.objects.length;
    room = addObjectFromAsset(room, portrait, creatorTypeLabels[analysis.creatorType], {
      type: "profile",
      data: {
        title: creatorTypeLabels[analysis.creatorType],
        description: analysis.summary,
        socials: analysis.socialLinks.map((l) => ({ label: l.label, url: l.url })),
      },
    });
    profileCreated = room.objects.length > before;
  }

  // One link object per supplied platform (Instagram / TikTok / YouTube / Website).
  const sign = getAsset("ast-sign");
  let socialObjects = 0;
  if (sign) {
    for (const link of analysis.socialLinks) {
      const before = room.objects.length;
      room = addObjectFromAsset(room, sign, link.label, {
        type: "link",
        data: { url: link.url, title: link.label, description: link.username ? `@${link.username}` : undefined },
      });
      if (room.objects.length > before) socialObjects += 1;
    }
  }

  const welcome = welcomeMessage(analysis);
  room = { ...room, description: welcome };

  const result: DesignResult = {
    ...base,
    room,
    parsed: { creatorType: analysis.creatorType, mood: analysis.mood, purpose: analysis.purpose, constraints: {} },
    detectedConstraints: [],
    picks: room.objects.map((o) => ({
      assetId: o.assetId,
      assetName: getAsset(o.assetId)?.name ?? o.assetId,
      label: o.label,
      action: o.actionType,
      reason: "",
    })),
    explanations: buildExplanations(analysis, welcome, socialObjects, profileCreated),
  };

  return { analysis, result, welcome, socialObjects, profileCreated };
}

function buildExplanations(analysis: CreatorAnalysis, welcome: string, socialObjects: number, profileCreated: boolean): string[] {
  const lines: string[] = [];
  lines.push(`Built from your profile — detected a ${creatorTypeLabels[analysis.creatorType].toLowerCase()} (confidence ${Math.round(analysis.confidence * 100)}%).`);
  lines.push(`Mood: ${moodLabels[analysis.mood]} · Purpose: ${purposeLabels[analysis.purpose]}.`);
  if (analysis.keywords.length > 0) lines.push(`Signals from your links/bio: ${analysis.keywords.slice(0, 6).join(", ")}.`);
  if (profileCreated) lines.push(`Added an About-me profile object with your title, summary, and links.`);
  if (socialObjects > 0) lines.push(`Added ${socialObjects} social ${socialObjects === 1 ? "object" : "objects"} (${analysis.socialLinks.map((l) => l.label).join(", ")}).`);
  lines.push(`Welcome message: “${welcome}”`);
  return lines;
}
