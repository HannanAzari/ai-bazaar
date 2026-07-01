// ── Nestudio V2 — Nest Editor local persistence (M6) ────────────────────────
//
// A small storage adapter over a namespaced localStorage key. This sprint persists
// drafts locally ONLY — no Supabase, no network. The storage backend is injectable
// (a `StorageLike`) so it is unit-testable without a browser, and SSR-safe (returns
// gracefully when no storage exists). Imports/exports validate before trusting JSON.

import type { EditableNestDocument } from "@/lib/nest-editor-types";
import { parseEditorDocument, serializeEditorDocument } from "@/lib/nest-editor";

/** Minimal subset of the Web Storage API we depend on (for testability). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const NS = "nestudio:nest-editor:v1";

export function draftKey(documentId: string): string {
  return `${NS}:${documentId}`;
}

/** Resolve the default backend (browser localStorage) or null on the server. */
function defaultStorage(): StorageLike | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    // Access can throw in privacy modes — treat as unavailable.
  }
  return null;
}

export interface SaveResult {
  ok: boolean;
  key: string;
  error?: string;
}

/** Persist a draft under its namespaced key. */
export function saveDraft(doc: EditableNestDocument, storage: StorageLike | null = defaultStorage()): SaveResult {
  const key = draftKey(doc.id);
  if (!storage) return { ok: false, key, error: "no storage available" };
  try {
    storage.setItem(key, serializeEditorDocument(doc));
    return { ok: true, key };
  } catch (e) {
    return { ok: false, key, error: (e as Error).message };
  }
}

export interface LoadResult {
  ok: boolean;
  doc?: EditableNestDocument;
  errors: string[];
}

/** Load + validate a draft. Malformed/absent drafts return clear errors (never throw). */
export function loadDraft(documentId: string, storage: StorageLike | null = defaultStorage()): LoadResult {
  const key = draftKey(documentId);
  if (!storage) return { ok: false, errors: ["no storage available"] };
  const raw = storage.getItem(key);
  if (raw == null) return { ok: false, errors: ["no saved draft"] };
  const parsed = parseEditorDocument(raw);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  return { ok: true, doc: parsed.doc, errors: [] };
}

/** Remove a saved draft. */
export function clearDraft(documentId: string, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  storage.removeItem(draftKey(documentId));
}

/**
 * Validate untrusted JSON before importing (never auto-trusts malformed input).
 * Returns the parsed document or clear validation errors.
 */
export function importDocumentJson(json: string): LoadResult {
  const parsed = parseEditorDocument(json);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  return { ok: true, doc: parsed.doc, errors: [] };
}
