import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_UPLOAD_MIME,
  MAX_UPLOAD_BYTES,
  NEST_MEDIA_BUCKET,
  assertNoInlineMedia,
  isDataUrl,
  mediaKey,
  shortSourceLabel,
  uploadErrorMessage,
  uploadRejection,
} from "@/lib/nest-media";

// ── M27A — media storage ─────────────────────────────────────────────────────
//
// ROOT CAUSE, verified against the live project before any code changed:
//
//     GET  /storage/v1/bucket                 ->  200  []
//     POST /storage/v1/object/nest-media/...  ->  {"code":"NoSuchBucket"}
//
// The project has ZERO storage buckets. `nest-media` was specified in M26-S but that SQL
// was never applied, so every upload failed at the first call. Nothing in the client was
// broken — which is why no amount of reading the upload helper would have found it.

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const sql = read("supabase", "provision", "m27a_media_storage.sql");
const panel = read("components", "nest", "editor", "interaction-panel.tsx");
const verifier = read("scripts", "verify-nest-media.mjs");

// ── §2 — the canonical object key ────────────────────────────────────────────

describe("§2 — <ownerId>/<nestId>/<objectId>/<mediaId>.<ext>", () => {
  it("builds the canonical path", () => {
    expect(mediaKey("u1", "nest-a", "ast-tv-0", "abc123", "jpg")).toBe("u1/nest-a/ast-tv-0/abc123.jpg");
  });

  it("puts the owner FIRST — every policy depends on it", () => {
    // `(storage.foldername(name))[1]` is the owner. If the first segment were anything
    // else, a creator could write into another creator's prefix.
    expect(mediaKey("owner-9", "n", "o", "m", "png").split("/")[0]).toBe("owner-9");
    expect(sql).toContain("(storage.foldername(name))[1] = auth.uid()::text");
  });

  it("is addressable per OBJECT, so one item can be deleted precisely", () => {
    const a = mediaKey("u", "n", "obj-1", "m1", "png");
    const b = mediaKey("u", "n", "obj-2", "m1", "png");
    expect(a).not.toBe(b);
    expect(a.split("/")[2]).toBe("obj-1");
  });

  it("sanitises every segment — no spaces, quotes or parentheses reach a key", () => {
    const k = mediaKey("u 1", "nest (a)", "obj'x", "My Photo (1)", "JPG");
    expect(k).not.toMatch(/[()'\s]/);
    expect(k.endsWith(".jpg")).toBe(true);
  });

  it("never produces an empty segment", () => {
    expect(mediaKey("", "", "", "", "")).toBe("x/x/x/x.bin");
  });
});

// ── §3 — what may be uploaded ────────────────────────────────────────────────

describe("§3 — supported files", () => {
  it("accepts JPEG, PNG, WebP, MP4 and WebM", () => {
    for (const m of ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]) {
      expect(uploadRejection({ type: m, size: 1000, name: "f" })).toBeNull();
      expect(ALLOWED_UPLOAD_MIME[m]).toBeTruthy();
    }
  });

  it("says audio is not supported YET, rather than something generic", () => {
    expect(uploadRejection({ type: "audio/mpeg", size: 1000, name: "s.mp3" })).toMatch(/Audio isn't supported yet/);
  });

  it("names the formats that DO work when a format is rejected", () => {
    expect(uploadRejection({ type: "image/heic", size: 10, name: "p.heic" })).toMatch(/JPEG, PNG or WebP/);
    // M27C §P3 — the video sentence changed on purpose. It used to name the two container
    // formats ("MP4 or WebM"); it now names MP4 and offers the route that always works for a
    // phone recording nobody can transcode — connecting a YouTube link. Same intent, better
    // next step, and the same sentence is reused for the codec probe so a creator never sees
    // two different explanations of one problem.
    expect(uploadRejection({ type: "video/avi", size: 10, name: "v.avi" })).toMatch(/MP4/);
    expect(uploadRejection({ type: "video/avi", size: 10, name: "v.avi" })).toMatch(/YouTube/);
  });

  it("rejects an oversized file BEFORE uploading it over a phone connection", () => {
    const msg = uploadRejection({ type: "image/jpeg", size: MAX_UPLOAD_BYTES + 1, name: "big.jpg" });
    expect(msg).toMatch(/25 MB/);
  });

  it("rejects an empty file", () => {
    expect(uploadRejection({ type: "image/png", size: 0, name: "e.png" })).toMatch(/empty/);
  });

  it("the client allow-list and the bucket allow-list agree", () => {
    // If these drift, a file passes the client check and then dies on a 400 from Storage.
    for (const m of Object.keys(ALLOWED_UPLOAD_MIME)) expect(sql).toContain(`'${m}'`);
    expect(sql).toContain(String(MAX_UPLOAD_BYTES));
  });

  it("audio is NOT in the bucket allow-list this sprint", () => {
    expect(sql).not.toMatch(/'audio\//);
  });
});

// ── §4 — no base64, ever ─────────────────────────────────────────────────────

describe("§4 — inline media can never be persisted", () => {
  it("recognises a data URL", () => {
    expect(isDataUrl("data:image/jpeg;base64,/9j/4AAQ")).toBe(true);
    expect(isDataUrl("https://x.test/p.jpg")).toBe(false);
  });

  it("refuses to write a document containing one", () => {
    expect(() => assertNoInlineMedia({ url: "data:image/png;base64,AAA" }, "t")).toThrow(/inline media/);
    expect(() => assertNoInlineMedia({ url: "https://x.test/p.jpg" }, "t")).not.toThrow();
  });

  it("legacy base64 still RENDERS — compatibility, not resurrection", () => {
    // Existing Nests carrying base64 must keep working; they are simply never written
    // that way again.
    expect(shortSourceLabel("data:image/jpeg;base64,/9j/4AAQ")).toBe("Uploaded file");
  });
});

// ── §5 — the lifecycle, and not orphaning uploads ────────────────────────────

describe("§5 — a removed item takes its storage object with it", () => {
  it("the document keeps the storage PATH, not only the URL", () => {
    // Without this the delete had nothing to target and every upload leaked. A URL is a
    // rendering detail; the path is the durable identity.
    const types = read("lib", "nest-asset-interaction.ts");
    expect(types).toContain("storagePath?: string;");
    expect(panel).toContain("storagePath: ref.storagePath");
  });

  it("removing the item deletes the object", () => {
    expect(panel).toContain("if (path) void removeNestMedia(path);");
  });

  it("the delete is best-effort and never blocks the edit", () => {
    const media = read("lib", "nest-media.ts");
    expect(media).toContain("export async function removeNestMedia(storagePath: string): Promise<boolean>");
  });

  it("the upload passes the object id, so the key is per-object", () => {
    expect(panel).toContain("objectId: object.instanceId");
  });
});

// ── §2 — the SQL itself ──────────────────────────────────────────────────────

describe("§2 — the provisioning file", () => {
  it("is additive and idempotent", () => {
    expect(sql).toContain("on conflict (id) do update");
    expect(sql).not.toMatch(/\bdrop\s+(table|bucket|schema)\b/i);
    // Policies are dropped by name before creation — that is what makes a re-run safe.
    expect((sql.match(/drop policy if exists/g) ?? []).length).toBe(4);
  });

  it("creates all four policies", () => {
    for (const p of ["nest_media_read", "nest_media_insert_own", "nest_media_update_own", "nest_media_delete_own"]) {
      expect(sql).toContain(p);
    }
  });

  it("write policies are restricted to authenticated users", () => {
    for (const op of ["insert", "update", "delete"]) {
      expect(sql).toMatch(new RegExp(`for ${op} to authenticated`));
    }
  });

  it("UPDATE constrains what a row may BECOME, not just which rows are targeted", () => {
    // Without the WITH CHECK a creator could move an object into someone else's prefix.
    const upd = sql.slice(sql.indexOf("nest_media_update_own"));
    const body = upd.slice(0, upd.indexOf("nest_media_delete_own"));
    expect(body).toContain("using (");
    expect(body).toContain("with check (");
  });

  it("READ is open — that is what makes a published Nest render for a visitor", () => {
    expect(sql).toMatch(/create policy "nest_media_read"[\s\S]*?for select[\s\S]*?using \(\s*bucket_id = 'nest-media'\s*\)/);
  });

  it("carries no service-role key or secret", () => {
    expect(sql).not.toMatch(/service_role|SUPABASE_SERVICE|secret/i);
  });

  it("documents the public-bucket trade-off honestly", () => {
    // "Public" means readable by anyone with the URL, including draft media. Saying so is
    // part of the contract, not a footnote.
    expect(sql).toMatch(/HONEST CAVEAT/);
  });
});

// ── The error a creator actually sees ────────────────────────────────────────

describe("the failure names its own fix", () => {
  it("Bucket not found points at the SQL file", () => {
    const m = uploadErrorMessage("Bucket not found");
    expect(m).toContain("m27a_media_storage.sql");
    expect(m).toContain(NEST_MEDIA_BUCKET);
    expect(m).toContain("Your Nest is unchanged.");
  });

  it("NoSuchBucket is recognised too — that is the raw code Storage returns", () => {
    expect(uploadErrorMessage("NoSuchBucket")).toContain("m27a_media_storage.sql");
  });

  it("an auth failure says to sign in, not to run SQL", () => {
    expect(uploadErrorMessage("new row violates row-level security policy")).toMatch(/signed in/);
  });

  it("an unknown failure still reassures that nothing was changed", () => {
    expect(uploadErrorMessage("kaboom")).toBe("Upload failed (kaboom). Your Nest is unchanged.");
  });
});

describe("the verifier proves the policies, not just the bucket", () => {
  it("uses only the anon key — the same credential the browser has", () => {
    expect(verifier).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(verifier).not.toMatch(/service_role|SERVICE_ROLE/);
  });

  it("checks that anonymous WRITE is refused", () => {
    expect(verifier).toContain("anonymous write refused");
  });
});
