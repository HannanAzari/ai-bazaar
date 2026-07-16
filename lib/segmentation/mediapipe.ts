/**
 * lib/segmentation/mediapipe.ts — the primary, real, ON-DEVICE segmenter.
 *
 * Google MediaPipe Interactive Image Segmenter (the `magic_touch` model): tap a
 * point, get the object under it. Inference runs entirely in the browser via WASM
 * (SIMD/GPU) — NO server roundtrip, NO Gemini, NO prompt. The WASM runtime streams
 * once from the jsdelivr CDN (cached); the model is bundled locally in
 * /public/models. If anything fails to load, ready() stays false and the caller
 * uses the local flood fallback — the experience never fails.
 */

import { makeCanvas } from "@/lib/ai/canvas";
import type { DetectedObject, NormPoint, SegMask, Segmenter } from "./types";
import { maskArea, maskBBox, borderFraction, iou } from "./mask-utils";

const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_PATH = "/models/magic_touch.tflite";

// Loosely typed to avoid a hard type dependency on the SDK internals.
type MPMask = { width: number; height: number; getAsUint8Array(): Uint8Array; close(): void };
type MPResult = { categoryMask?: MPMask; confidenceMasks?: MPMask[]; close?: () => void };
type MPSegmenter = { segment(image: HTMLCanvasElement, roi: { keypoint: NormPoint }): MPResult; close(): void };

let instance: MPSegmenter | null = null;
let ok = false;
let initStarted = false;

async function create(delegate: "GPU" | "CPU"): Promise<MPSegmenter> {
  const vision = await import("@mediapipe/tasks-vision");
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM_CDN);
  return (await vision.InteractiveSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    outputCategoryMask: true,
    outputConfidenceMasks: false,
  })) as unknown as MPSegmenter;
}

/** Extract the foreground mask: pixels sharing the tapped point's category value. */
function extract(result: MPResult, p: NormPoint): SegMask | null {
  const m = result.categoryMask ?? result.confidenceMasks?.[0];
  if (!m) return null;
  const w = m.width, h = m.height;
  const raw = m.getAsUint8Array();
  const tx = Math.min(w - 1, Math.max(0, Math.round(p.x * w)));
  const ty = Math.min(h - 1, Math.max(0, Math.round(p.y * h)));
  const tapVal = raw[ty * w + tx];
  const data = new Uint8ClampedArray(w * h);
  // Foreground = same category as the tapped pixel, unless that's clearly the
  // background sheet (then take the complement).
  for (let i = 0; i < raw.length; i++) data[i] = raw[i] === tapVal ? 255 : 0;
  const mask: SegMask = { width: w, height: h, data };
  if (borderFraction(mask) > 0.6) {
    for (let i = 0; i < data.length; i++) data[i] = 255 - data[i];
  }
  return mask;
}

export const mediapipeSegmenter: Segmenter = {
  id: "mediapipe",
  label: "On-device model",
  ready: () => ok,

  async init() {
    if (initStarted) return;
    initStarted = true;
    try {
      try {
        instance = await create("GPU");
      } catch {
        instance = await create("CPU");
      }
      ok = true;
    } catch {
      ok = false;
      instance = null;
    }
  },

  async segmentAtPoint(source: HTMLCanvasElement, p: NormPoint): Promise<SegMask> {
    if (!instance) throw new Error("segmenter not ready");
    const result = instance.segment(source, { keypoint: { x: p.x, y: p.y } });
    const mask = extract(result, p);
    result.categoryMask?.close();
    result.confidenceMasks?.forEach((c) => c.close());
    result.close?.();
    if (!mask) throw new Error("no mask");
    return mask;
  },

  async detect(source: HTMLCanvasElement): Promise<DetectedObject[]> {
    // Scale to a modest size for the multi-seed scan; per-tap uses full source.
    const scale = Math.min(1, 512 / Math.max(source.width, source.height));
    const w = Math.max(1, Math.round(source.width * scale));
    const h = Math.max(1, Math.round(source.height * scale));
    const c = makeCanvas(w, h);
    c.getContext("2d")!.drawImage(source, 0, 0, w, h);
    const seeds: NormPoint[] = [
      { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.38 }, { x: 0.38, y: 0.58 }, { x: 0.62, y: 0.58 },
    ];
    const objs: DetectedObject[] = [];
    for (const s of seeds) {
      try {
        const mask = await this.segmentAtPoint(c, s);
        if (borderFraction(mask) > 0.7) continue;
        const area = maskArea(mask);
        if (area < w * h * 0.01) continue;
        if (objs.some((o) => iou(o.mask, mask) > 0.6)) continue;
        const bbox = maskBBox(mask);
        if (bbox) objs.push({ id: `m${objs.length}`, mask, bbox, area });
      } catch {
        /* skip this seed */
      }
    }
    return objs.sort((a, b) => b.area - a.area).slice(0, 4);
  },
};
