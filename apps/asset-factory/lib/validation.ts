import { CATEGORY_META, type FactoryCategory, type AssetCandidate } from "@/lib/types";
import { slugify } from "@/lib/slug";

// Import / upload validation (Task 6). Validates the minimum a candidate needs to
// enter review: a usable image reference, a PNG/WebP type, dimensions, a category,
// and a name. Transparency is *preferred*, not required (a warning, not an error).

export type ValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

/** Raw fields coming from an import form / pasted JSON, before normalization. */
export type ImportInput = {
  name?: string;
  category?: string;
  imageUrl?: string;
  localPath?: string;
  width?: number;
  height?: number;
  transparent?: boolean;
  tags?: string[];
};

const IMAGE_EXT = /\.(png|webp)(\?.*)?$/i;
const DATA_URL = /^data:image\/(png|webp);/i;

/** Is the reference a PNG/WebP by extension or data-url? */
export function isAcceptedImageType(ref: string): boolean {
  return IMAGE_EXT.test(ref) || DATA_URL.test(ref);
}

export function isKnownCategory(value: string | undefined): value is FactoryCategory {
  return !!value && value in CATEGORY_META;
}

/** Validate a candidate import. Errors block; warnings inform. */
export function validateImport(input: ImportInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.name || !input.name.trim()) {
    errors.push("Name is required.");
  }

  if (!isKnownCategory(input.category)) {
    errors.push("A valid category is required.");
  }

  const ref = input.imageUrl?.trim() || input.localPath?.trim() || "";
  if (!ref) {
    errors.push("An image URL or local path is required.");
  } else if (!isAcceptedImageType(ref)) {
    errors.push("Image must be a PNG or WebP file.");
  }

  if (!input.width || !input.height || input.width <= 0 || input.height <= 0) {
    errors.push("Image width and height are required.");
  }

  if (input.transparent === false) {
    warnings.push("Transparent background is preferred — this image is flagged opaque.");
  }

  if (!input.tags || input.tags.length === 0) {
    warnings.push("Tags are suggested for discovery.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Build a normalized AssetCandidate from validated import input. Fills the
 * Nestudio-export defaults from the category. Throws if input is invalid, so
 * callers should run validateImport first.
 */
export function candidateFromImport(
  input: ImportInput,
  options: { pack?: string; reviewer?: string } = {},
): AssetCandidate {
  const result = validateImport(input);
  if (!result.ok) {
    throw new Error(`Invalid import: ${result.errors.join(" ")}`);
  }
  const category = input.category as FactoryCategory;
  const meta = CATEGORY_META[category];
  const name = input.name!.trim();
  const slug = slugify(name);
  const now = new Date().toISOString();

  return {
    id: `${category}-${slug}-${Date.now().toString(36)}`,
    name,
    slug,
    category,
    pack: options.pack?.trim() || "imported",
    status: "needs_review",
    imageUrl: input.imageUrl?.trim() || input.localPath?.trim() || "",
    localPath: input.localPath?.trim() || undefined,
    prompt: "",
    negativePrompt: "",
    modelProvider: "manual",
    modelName: "import",
    seed: 0,
    width: input.width!,
    height: input.height!,
    transparent: input.transparent ?? true,
    tags: input.tags ?? [],
    compatibleZones: meta.compatibleZones,
    placementType: meta.placement,
    defaultScale: meta.defaultScale,
    defaultActionType: meta.defaultActionType,
    styleScore: 0,
    qualityNotes: "",
    reviewer: "",
    reviewedAt: "",
    createdAt: now,
  };
}

/**
 * Parse a JSON string into an array of ImportInput (accepts a single object or an
 * array). Returns a typed result rather than throwing, for the bulk-import UI.
 */
export function parseImportJson(
  raw: string,
): { ok: true; items: ImportInput[] } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Not valid JSON." };
  }
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  if (arr.some((x) => typeof x !== "object" || x === null)) {
    return { ok: false, error: "Expected an object or array of objects." };
  }
  return { ok: true, items: arr as ImportInput[] };
}
