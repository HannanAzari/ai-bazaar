"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Link2, Upload, X } from "lucide-react";
import { MobileBottomSheet, type BottomSheetSnapPoint } from "@/components/nest/editor/mobile-bottom-sheet";
import { capabilitiesForAsset, type AssetInteractionConfig, type ConnectedContent } from "@/lib/nest-asset-interaction";
import { contentRejection, detectContentSource } from "@/lib/nest-content-source";
import { removeNestMedia, shortSourceLabel, uploadNestMedia } from "@/lib/nest-media";
import { addContent, contentThumbnail, moveContent, removeContentAt, storedContents } from "@/lib/nest-contents";
import type { EditableNestObject } from "@/lib/nest-editor-types";

// ── M26-R §P5/§P6 — Connect ──────────────────────────────────────────────────
//
//     Interaction belongs to the asset. Content belongs to the creator.
//
// A TV already behaves like a TV. The creator is never asked to enable interaction, pick an
// action type, choose a source type or set a starting state — the previous sheet asked for
// five decisions to hang one video on a screen. This asks for one:
//
//     Paste a link, or upload something.
//
// Nestudio detects what it is (`lib/nest-content-source.ts`) and says so in plain words.
// If the object cannot show that kind of thing, it says which kinds it CAN show.
//
// There is no explicit Save. Changing the content updates the editor document immediately
// and `Done` closes the sheet; the Nest's own draft/publish is what persists. That removes
// the entire class of a save that reported success and dropped the link (P18).

export function InteractionPanel({
  object,
  assetName,
  assetThumbUrl,
  snap,
  onSnapChange,
  onCommit,
  onClose,
  ownerId,
  nestId,
}: {
  object: EditableNestObject;
  assetName: string;
  assetThumbUrl?: string;
  /** M26-S §9 — Storage keys are `<ownerId>/<nestId>/…`; the policies depend on it. */
  ownerId?: string;
  nestId?: string;
  snap: BottomSheetSnapPoint;
  onSnapChange: (s: BottomSheetSnapPoint) => void;
  onCommit: (config: AssetInteractionConfig | undefined) => void;
  onClose: () => void;
}) {
  const def = capabilitiesForAsset(object.assetId);
  const cfg = object.assetInteraction;

  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Re-seed only when a DIFFERENT object is selected. Keying on the committed value is what
  // made the old sheet reset its own field the instant a save landed (D-50).
  useEffect(() => {
    setDraft("");
    setError(null);
    setJustSaved(false);
  }, [object.instanceId]);

  const header = (
    <div className="flex items-center gap-2.5 px-4 pb-2 pt-1">
      {assetThumbUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element -- local curated art */
        <img src={assetThumbUrl} alt="" className="size-9 shrink-0 rounded-lg object-contain" />
      ) : null}
      <h3 className="display min-w-0 flex-1 truncate text-[17px] leading-tight text-ink">{assetName}</h3>
      <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full text-ink/45 hover:bg-ink/5">
        <X className="size-5" />
      </button>
    </div>
  );

  // Scenery, or an object whose behaviour needs nothing from the creator (a lamp, a
  // curtain). Say so plainly — offering a link field for a lamp is the confusion this
  // sprint exists to remove.
  if (!def || !def.accepts.length) {
    return (
      <MobileBottomSheet open label="Connect" header={header} snap={snap} onSnapChange={onSnapChange} onClose={onClose}>
        <div className="px-4 pb-8">
          <p className="text-[15px] leading-relaxed text-ink/65">
            {def
              ? `${assetName} already works on its own — visitors can tap it. There's nothing to add.`
              : `${assetName} is decoration. Visitors can zoom right in on it, so it's worth placing carefully.`}
          </p>
        </div>
      </MobileBottomSheet>
    );
  }

  function connect(detected: ReturnType<typeof detectContentSource>) {
    if (!detected) {
      setError("That doesn’t look like a link. It should start with https://");
      return;
    }
    const reject = contentRejection(detected, def!.accepts, assetName);
    if (reject) {
      setError(reject);
      return;
    }
    setError(null);
    // §2 — ADD to the list, never replace it.
    const next: ConnectedContent = { kind: detected.kind, url: detected.url, ...(detected.label ? { label: detected.label } : {}) };
    onCommit(addContent(cfg, next));
    setDraft("");
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1600);
  }

  /**
   * M26-S §9 — an upload goes to Storage, and the document keeps a reference.
   *
   * It used to be read as a base64 `data:` URL and written straight into the Nest, so a
   * single phone photo became a multi-megabyte string re-sent on every feed read. There is
   * deliberately NO base64 fallback: if the upload fails the creator is told, because a
   * silent fallback would quietly turn their Nest back into a file container.
   */
  async function onPickFile(file: File | undefined) {
    if (!file || !ownerId || !nestId) {
      if (file) setError("Uploads need you to be signed in with a saved Nest.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const ref = await uploadNestMedia(file, { ownerId, nestId, objectId: object.instanceId });
      const kind = ref.kind === "audio" ? "audio" : ref.kind;
      const reject = contentRejection({ kind, url: ref.url, label: ref.kind }, def!.accepts, assetName);
      if (reject) { setError(reject); return; }
      // §5 — the storage path travels with the reference, so removal can clean up.
      onCommit(addContent(cfg, { kind, url: ref.url, storagePath: ref.storagePath, label: ref.title ?? ref.kind }));
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That upload didn't work. Your Nest is unchanged.");
    } finally {
      setUploading(false);
    }
  }

  // ── M27B-2 — the content manager ────────────────────────────────────────────
  //
  // A compatible object holds a LIST. `storedContents` is the editing view — it shows the
  // creator exactly what they have, including an item the asset would reject, so they can
  // see it and delete it rather than wonder why nothing appears.
  const items = storedContents(cfg);

  const put = (next: AssetInteractionConfig) => onCommit(Object.keys(next).length ? next : undefined);

  const removeAt = (i: number) => {
    // Remove the storage object too, so uploads are never orphaned. Fire-and-forget: a
    // failed delete leaves wasted bytes, never a broken Nest, and must not block the edit.
    const path = items[i]?.storagePath;
    put(removeContentAt(cfg, i));
    setError(null);
    if (path) void removeNestMedia(path);
  };

  return (
    <MobileBottomSheet open label="Connect" header={header} snap={snap} onSnapChange={onSnapChange} onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {items.length ? (
            <section>
              <p className="text-[13px] font-bold text-ink/50">
                {def.screenSurfaceId ? (def.accepts.includes("youtube") ? "Playlist" : "Photos") : "Connected"}
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {items.map((item, i) => (
                  <ContentRow
                    key={`${item.url ?? item.storagePath ?? "item"}-${i}`}
                    item={item}
                    index={i}
                    count={items.length}
                    onRemove={() => removeAt(i)}
                    onMove={(d: number) => put(moveContent(cfg, i, i + d))}
                  />
                ))}
              </ul>
            </section>
          ) : (
            <p className="text-[15px] leading-relaxed text-ink/65">
              Paste a link or upload something, and it&rsquo;ll appear
              {def.screenSurfaceId ? " on the screen" : " when someone taps it"}.
            </p>
          )}

          <div className="mt-2.5 space-y-2.5">
            <label className="block">
              <span className="sr-only">Paste a link</span>
              <input
                value={draft}
                onChange={(e) => { setDraft(e.target.value); setError(null); }}
                onFocus={() => onSnapChange("expanded")}
                onPaste={(e) => {
                  // Paste is the whole interaction — act on it without a second tap.
                  const text = e.clipboardData.getData("text");
                  if (text) {
                    e.preventDefault();
                    setDraft(text);
                    connect(detectContentSource(text));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); connect(detectContentSource(draft)); }
                }}
                type="url"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
                placeholder="Paste a link"
                /* text-base = 16px. Below that, iOS Safari zooms the whole page on focus and
                   does not reliably zoom back out (D-49). */
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-3 text-base text-ink outline-none focus:border-ink/40"
              />
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => connect(detectContentSource(draft))}
                disabled={!draft.trim()}
                className="flex-1 rounded-xl bg-ink px-4 py-3 text-[15px] font-bold text-parchment transition disabled:opacity-40"
              >
                <span className="inline-flex items-center justify-center gap-1.5"><Link2 className="size-4" /> Add link</span>
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-ink/15 px-3.5 py-3 text-[15px] font-bold text-ink/70 disabled:opacity-50"
              >
                <Upload className="size-4" /> {uploading ? "Uploading…" : "Upload"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*,audio/*"
                className="hidden"
                onChange={(e) => { void onPickFile(e.target.files?.[0]); e.target.value = ""; }}
              />
            </div>
          </div>

          {error ? (
            <p role="alert" className="mt-3 rounded-xl bg-terracotta/10 px-3 py-2 text-[13px] font-bold leading-snug text-terracotta">
              {error}
            </p>
          ) : null}
        </div>

        <div className="sticky bottom-0 border-t border-ink/10 bg-parchment/95 px-4 py-3 backdrop-blur" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
          <button
            type="button"
            onClick={onClose}
            className={`w-full rounded-xl px-4 py-3 text-[15px] font-bold text-parchment transition ${justSaved ? "bg-meadow" : "bg-terracotta"}`}
          >
            {justSaved ? (
              <span className="inline-flex items-center justify-center gap-1.5"><Check className="size-4" /> Added</span>
            ) : (
              "Done"
            )}
          </button>
        </div>
      </div>
    </MobileBottomSheet>
  );
}

/**
 * M27B-2 — one item in the content list.
 *
 * The THUMBNAIL is the item's identity. Everything the founder asked never to see again —
 * base64, storage paths, giant filenames, full signed URLs — is deliberately impossible
 * here: the title falls back to a short kind label and the subtitle to a host name, both
 * truncated, and neither ever prints `item.url` in full.
 */
function ContentRow({
  item,
  index,
  count,
  onRemove,
  onMove,
}: {
  item: ConnectedContent;
  index: number;
  count: number;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  const thumb = contentThumbnail(item);
  const source = item.url ? detectContentSource(item.url) : null;
  const KIND_LABEL: Record<string, string> = { youtube: "YouTube video", image: "Photo", video: "Video", audio: "Audio", website: "Link" };
  const title = item.label?.trim() || source?.label || KIND_LABEL[item.kind] || "Content";
  return (
    <li className="flex items-center gap-2.5 rounded-2xl border border-ink/12 bg-white/60 p-2">
      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-ink/10 bg-ink/[0.04]">
        {thumb ? (
          /* eslint-disable-next-line @next/next/no-img-element -- creator media, already a URL */
          <img src={thumb} alt="" className="size-full object-cover" />
        ) : (
          <Link2 className="size-4 text-ink/35" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-bold leading-tight text-ink">{title}</span>
        {/* Never a raw URL at length — a host name or a file name is all a creator needs. */}
        <span className="mt-0.5 block truncate text-[12px] leading-snug text-ink/45">
          {item.storagePath ? "Uploaded" : shortSourceLabel(item.url ?? "")}
          {index === 0 && count > 1 ? " · showing" : ""}
        </span>
      </span>
      <span className="flex shrink-0 items-center">
        <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}
          className="grid size-8 place-items-center rounded-lg text-ink/45 disabled:opacity-25">
          <ChevronUp className="size-4" />
        </button>
        <button type="button" aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(1)}
          className="grid size-8 place-items-center rounded-lg text-ink/45 disabled:opacity-25">
          <ChevronDown className="size-4" />
        </button>
        <button type="button" aria-label="Remove" onClick={onRemove}
          className="grid size-8 place-items-center rounded-lg text-ink/40 hover:text-terracotta">
          <X className="size-4" />
        </button>
      </span>
    </li>
  );
}
