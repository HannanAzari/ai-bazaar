// ── M12 — Nest persistence facade (local | supabase) ─────────────────────────
//
// One async API the nest flow (onboarding · editor · visitor) uses. The backend is
// chosen by NEXT_PUBLIC_NEST_BACKEND (default "local" → the M11 localStorage path,
// unchanged + verified). When set to "supabase", nests persist to Postgres with
// server-enforced visibility + real payload-free URLs. Every Supabase call has a
// SAFE LOCAL FALLBACK so the app never hard-breaks if the schema isn't applied yet.

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
import * as sbRepo from "@/lib/nest/supabase-nest-repo";

export type NestBackend = "local" | "supabase";
export function nestBackend(): NestBackend {
  return process.env.NEXT_PUBLIC_NEST_BACKEND === "supabase" ? "supabase" : "local";
}
const isSupabaseBackend = () => nestBackend() === "supabase";

export type ResolveResult =
  | { kind: "ok"; doc: NestDocument }
  | { kind: "private" }
  | { kind: "notfound" };

// ── Create ───────────────────────────────────────────────────────────────────
export async function createFromTemplate(templateId: string): Promise<NestDocument | undefined> {
  if (isSupabaseBackend()) {
    const tpl = resolveTemplate(templateId);
    if (!tpl) return undefined;
    try {
      return await sbRepo.createNest({
        backgroundId: tpl.backgroundId, title: tpl.name, sourceTemplateId: tpl.id,
        placements: tpl.objectPlacements.map((p, i) => ({ id: `pl-${i}`, assetId: p.assetId, x: p.x, y: p.y, scale: p.scale, zIndex: p.zIndex })),
      });
    } catch {
      /* fall back so a not-yet-applied schema never blocks creation */
    }
  }
  return localCreateFromTemplate(templateId);
}

export async function createFromBackground(backgroundId: string, title = "My Nest"): Promise<NestDocument> {
  if (isSupabaseBackend()) {
    try {
      return await sbRepo.createNest({ backgroundId, title, placements: [] });
    } catch {
      /* fall back */
    }
  }
  return localCreateFromBackground(backgroundId, title);
}

// ── Load / save ────────────────────────────────────────────────────────────--
export async function loadDoc(id: string): Promise<NestDocument | undefined> {
  if (isSupabaseBackend()) {
    try {
      const doc = await sbRepo.getNest(id);
      if (doc) return doc;
    } catch {
      /* fall back */
    }
  }
  return localGetDoc(id);
}

export async function persistDoc(doc: NestDocument): Promise<NestDocument> {
  if (isSupabaseBackend()) {
    try {
      return await sbRepo.saveNest(doc);
    } catch {
      /* fall back */
    }
  }
  return localSaveDoc(doc);
}

// ── Publish ────────────────────────────────────────────────────────────────--
export async function publish(id: string, visibility: NestVisibility): Promise<PublishResult | undefined> {
  if (isSupabaseBackend()) {
    try {
      const r = await sbRepo.publishNest(id, visibility);
      if (r) return r;
    } catch {
      /* fall back to the self-contained local URL */
    }
  }
  const session = localSession();
  return localPublish(id, visibility, session?.userId ?? "local-owner");
}

// ── Visitor resolution ─────────────────────────────────────────────────────--
export async function resolvePublished(slug: string, encoded?: string): Promise<ResolveResult> {
  // A self-contained shareable link resolves in any backend/browser.
  if (encoded) {
    const doc = decodeDoc(encoded);
    return doc ? { kind: "ok", doc } : { kind: "notfound" };
  }
  if (isSupabaseBackend()) {
    try {
      const doc = await sbRepo.resolveNestBySlug(slug);
      // RLS returns the row only if world-readable or owned; null → hidden/absent.
      return doc ? { kind: "ok", doc } : { kind: "private" };
    } catch {
      /* fall back to local */
    }
  }
  const found = resolvePublishedBySlug(slug);
  if (!found) return { kind: "notfound" };
  const { doc, ref } = found;
  if (isShareable(ref.visibility)) return { kind: "ok", doc };
  const session = localSession();
  return session && session.userId === ref.ownerId ? { kind: "ok", doc } : { kind: "private" };
}

export type { PublishResult };
