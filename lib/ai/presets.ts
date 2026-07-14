/**
 * lib/ai/presets.ts — reusable style profiles.
 * -----------------------------------------------------------------------------
 * A style preset is a named bundle of style-token overrides + provider params
 * (e.g. relight strength, posterize levels). "Nestudio Classic" is enabled in
 * M21; Clay / Soft / Illustration are defined so the architecture is proven and a
 * later sprint enables them with a one-line flag. Every studio and the Admin
 * Factory pick a preset by id — the engine never hardcodes a look.
 */

import type { StyleTokens } from "./types";

export type StylePreset = {
  id: string;
  label: string;
  enabled: boolean;
  /** Partial style-token overrides merged onto NESTUDIO_STYLE. */
  style?: Partial<StyleTokens>;
  /** Provider params folded into the assembled prompt (relight, levels, guidance…). */
  params: Record<string, string | number | boolean>;
};

export const STYLE_PRESETS: Record<string, StylePreset> = {
  classic: {
    id: "classic",
    label: "Nestudio Classic",
    enabled: true,
    params: { relight: 0.22, guidance: 7 },
  },
  clay: {
    id: "clay",
    label: "Nestudio Clay",
    enabled: false,
    style: {
      descriptors: ["hand-sculpted clay miniature", "soft plasticine matte", "rounded chunky forms", "gentle fingerprints of the maker"],
      lighting: "soft warm studio light, deep soft ambient occlusion",
    },
    params: { relight: 0.3, guidance: 8 },
  },
  soft: {
    id: "soft",
    label: "Nestudio Soft",
    enabled: false,
    style: {
      descriptors: ["soft pastel 3D", "airy and gentle", "low-contrast matte", "rounded pillowy forms"],
      palette: ["pale cream", "soft blush", "muted sage", "powder blue"],
    },
    params: { relight: 0.15, guidance: 6 },
  },
  illustration: {
    id: "illustration",
    label: "Nestudio Illustration",
    enabled: false,
    style: {
      descriptors: ["flat storybook illustration", "clean vector-like shapes", "gentle cel shading", "hand-drawn charm"],
      lighting: "flat even light with a single soft shadow",
    },
    params: { relight: 0.1, guidance: 6, levels: 5 },
  },
};

export const DEFAULT_PRESET = "classic";

export function getPreset(id: string = DEFAULT_PRESET): StylePreset {
  return STYLE_PRESETS[id] ?? STYLE_PRESETS[DEFAULT_PRESET];
}

export function listPresets(): StylePreset[] {
  return Object.values(STYLE_PRESETS);
}
