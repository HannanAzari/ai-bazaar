// ── M23B — Nest persistence facade (local | supabase) ────────────────────────
//
// One async API the Nest flow (editor · publish · visitor) uses. The backend is chosen
// by NEXT_PUBLIC_NEST_BACKEND: "local" is the localStorage demo path; "supabase" is the
// real product.
//
// ── THE RULE THAT CHANGED IN M23B ────────────────────────────────────────────
// This file used to wrap EVERY Supabase call in `catch { /* fall back */ }`. A missing
// table, an RLS denial or a dropped connection all looked like success, and the write
// quietly landed in the creator's own browser. That is why "everything works for me and
// nobody else can see it" survived for months.
//
// Now, on the Supabase backend:
//   • publish / resolve / save / create  →  errors PROPAGATE. The caller shows them.
//   • there is no silent localStorage substitute for anything public.
//
// localStorage keeps exactly one job: in-progress editor autosave (lib/nest-editor-storage)
// and the legacy local backend for demo mode. It is no longer the source of truth for
// anything a second person is supposed to see.

import type { NestDocument, NestVisibility } from "@/lib/nest-document-types";
import { isShareable } from "@/lib/nest-document-types";
import {
  createDocFromBackground as localCreateFromBackground,
  createDocFromTemplate as localCreateFromTemplate,
  decodeDoc,
  getDoc as localGetDoc,
  publishDoc as localPublish,
  resolvePublishedBySlug,
  saveDoc as localSaveDoc,
  type PublishResult,
} from "@/lib/nest-document-store";
import { resolveTemplate } from "@/lib/nest-production-library";
import { getSession as localSession } from "@/lib/nest-auth-stub";
import { hasSupabaseEnv } from "@/lib/supabase/project-info";
import * as sbRepo from "@/lib/nest/supabase-nest-repo";
import { NestRepoError } from "@/lib/nest/supabase-nest-repo";

export type NestBackend = "local" | "supabase";

/**
 * Which backend this build actually uses.
 *
 * HOTFIX (M23B.2) — THE BUG THIS FIXES:
 *
 *     return process.env.NEXT_PUBLIC_NEST_BACKEND === "supabase" ? "supabase" : "local";
 *
 * `NEXT_PUBLIC_*` is inlined at BUILD time. If that one variable was missing, misspelled,
 * or simply not set for a given Vercel environment, this silently returned "local" — and
 * "local" means sign-up writes an account to **localStorage**. The UI then reported
 * success and moved on, while Supabase never heard about the user. That is exactly what
 * the founder saw: an account created in the app that does not exist in
 * Authentication → Users.
 *
 * The presence of a configured Supabase project is now the source of truth, and the flag
 * is only an explicit override:
 *
 *   • `NEXT_PUBLIC_NEST_BACKEND=local`     → local, deliberately (demo/offline dev)
 *   • `NEXT_PUBLIC_NEST_BACKEND=supabase`  → supabase, explicitly
 *   • unset / anything else                → supabase IF Supabase env is present, else local
 *
 * So a deployment that has `NEXT_PUBLIC_SUPABASE_URL` + `_ANON_KEY` can no longer fall
 * into demo mode by omission. If it has neither, it is genuinely unconfigured — and the
 * auth screens say so loudly rather than quietly pretending to create accounts.
 */
export function nestBackend(): NestBackend {
  const explicit = process.env.NEXT_PUBLIC_NEST_BACKEND;
  if (explicit === "local") return "local";
  if (explicit === "supabase") return "supabase";
  return hasSupabaseEnv() ? "supabase" : "local";
}
const isSupabaseBackend = () => nestBackend() === "supabase";

export type ResolveResult =
  | { kind: "ok"; doc: NestDocument }
  | { kind: "private" }
  | { kind: "notfound" }
  /** The backend failed. Distinct from "not found" so the UI never blames the creator. */
  | { kind: "error"; message: string };

export { NestRepoError };

// ── Create ───────────────────────────────────────────────────────────────────
export async function createFromTemplate(templateId: string): Promise<NestDocument | undefined> {
  if (isSupabaseBackend()) {
    const tpl = resolveTemplate(templateId);
    if (!tpl) return undefined;
    return sbRepo.createNest({
      backgroundId: tpl.backgroundId,
      title: tpl.name,
      sourceTemplateId: tpl.id,
      placements: tpl.objectPlacements.map((p, i) => ({
        id: `pl-${i}`,
        assetId: p.assetId,
        x: p.x,
        y: p.y,
        scale: p.scale,
        zIndex: p.zIndex,
      })),
    });
  }
  return localCreateFromTemplate(templateId);
}

export async function createFromBackground(backgroundId: string, title = "My Nest"): Promise<NestDocument> {
  if (isSupabaseBackend()) {
    return sbRepo.createNest({ backgroundId, title, placements: [] });
  }
  return localCreateFromBackground(backgroundId, title);
}

// ── Load / save ──────────────────────────────────────────────────────────────
export async function loadDoc(id: string): Promise<NestDocument | undefined> {
  if (isSupabaseBackend()) {
    const doc = await sbRepo.getNest(id);
    // A local-only id (created before the cutover, or in demo mode) still opens — but a
    // *failure* to reach Supabase has already thrown by the time we get here.
    return doc ?? localGetDoc(id);
  }
  return localGetDoc(id);
}

export async function persistDoc(doc: NestDocument): Promise<NestDocument> {
  if (isSupabaseBackend()) return sbRepo.saveNest(doc);
  return localSaveDoc(doc);
}

// ── Publish ──────────────────────────────────────────────────────────────────
/**
 * Publish a Nest. On the Supabase backend this either produces a real, payload-free
 * `/nest/<slug>` URL or THROWS. It never silently degrades to a `?c=` link, because a
 * `?c=` link is not visible to anyone who didn't receive that exact URL.
 */
export async function publish(
  id: string,
  visibility: NestVisibility,
  ownerId?: string,
): Promise<PublishResult> {
  if (isSupabaseBackend()) return sbRepo.publishNest(id, visibility);
  const local = localPublish(id, visibility, ownerId ?? localSession()?.userId ?? "local-owner");
  if (!local) throw new NestRepoError("That Nest could not be found in this browser.");
  return local;
}

// ── Visitor resolution ───────────────────────────────────────────────────────
export async function resolvePublished(slug: string, encoded?: string): Promise<ResolveResult> {
  if (isSupabaseBackend()) {
    try {
      const doc = await sbRepo.resolveNestBySlug(slug);
      // RLS returns the row only if world-readable or owned; null ⇒ hidden or absent.
      if (doc) return { kind: "ok", doc };
    } catch (e) {
      // A backend failure is reported AS a backend failure. Falling through to the
      // `?c=` payload here would be the old lie in a new place: the visitor would see a
      // Nest that the server does not actually serve.
      return { kind: "error", message: e instanceof Error ? e.message : "The Nest service is unavailable." };
    }
    // Not on the server. A legacy `?c=` link may still carry the (lossy) composition —
    // decode it so old shared links keep opening, but never prefer it over the server.
    if (encoded) {
      const legacy = decodeDoc(encoded);
      if (legacy) return { kind: "ok", doc: legacy };
    }
    return { kind: "private" };
  }

  // ── Local/demo backend ─────────────────────────────────────────────────────
  if (encoded) {
    const doc = decodeDoc(encoded);
    return doc ? { kind: "ok", doc } : { kind: "notfound" };
  }
  const found = resolvePublishedBySlug(slug);
  if (!found) return { kind: "notfound" };
  const { doc, ref } = found;
  if (isShareable(ref.visibility)) return { kind: "ok", doc };
  const session = localSession();
  return session && session.userId === ref.ownerId ? { kind: "ok", doc } : { kind: "private" };
}

export type { PublishResult };
