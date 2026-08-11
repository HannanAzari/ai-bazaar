// ── M27B-2 — editing an object's content list ────────────────────────────────
//
// Pure list operations on `AssetInteractionConfig.contents`. No React, no storage, no
// network — the Connect panel calls these and commits the result like any other edit, so
// undo/redo, the dirty-state key and draft persistence all work with no special cases.
//
// Every function returns a NEW config and always writes the canonical `contents` array,
// never the legacy `connection`. A document that arrives with only a legacy connection is
// upgraded on its first edit, which is why no migration is needed: the list arrives when a
// creator next touches the object, and until then `resolveContents` reads the old shape.

import type { AssetInteractionConfig, ConnectedContent } from "@/lib/nest-asset-interaction";
import { youTubeThumbnailUrl, youTubeVideoId } from "@/lib/nest-interaction";

/**
 * M27B-2 — an item ready to store, with its thumbnail already resolved.
 *
 * A YouTube item's still is derived from its video id and WRITTEN, not recomputed on every
 * read: the Connect list, the object's aperture and the feed then all show the same picture
 * without each of them parsing a URL. `resolveContents` still derives it on read for legacy
 * documents that predate this, so both paths agree.
 */
export function withDerivedThumbnail(c: ConnectedContent): ConnectedContent {
  if (c.thumbnailUrl || c.kind !== "youtube" || !c.url) return c;
  const id = youTubeVideoId(c.url);
  return id ? { ...c, thumbnailUrl: youTubeThumbnailUrl(id) } : c;
}

/** The picture that represents one item in a list. Null when it has none. */
export function contentThumbnail(c: ConnectedContent): string | null {
  if (c.thumbnailUrl) return c.thumbnailUrl;
  if (c.kind === "image") return c.url ?? null;
  const withThumb = withDerivedThumbnail(c);
  return withThumb.thumbnailUrl ?? null;
}

/**
 * The list as stored, before normalisation — legacy single connection included.
 *
 * This is the EDITING view: it must show the creator exactly what they have, including an
 * item the asset would reject, so they can see it and remove it. `resolveContents` is the
 * RENDERING view and drops unusable items. Deliberately two different questions.
 */
export function storedContents(config: AssetInteractionConfig | undefined): ConnectedContent[] {
  if (!config) return [];
  if (config.contents?.length) return config.contents;
  return config.connection ? [config.connection] : [];
}

/** Append an item, and make it current when it is the first. */
export function addContent(config: AssetInteractionConfig | undefined, item: ConnectedContent): AssetInteractionConfig {
  const list = [...storedContents(config), withDerivedThumbnail(item)];
  return commit(config, list, config?.activeIndex ?? 0);
}

/**
 * Remove one item, keeping the creator looking at something sensible.
 *
 * Removing the item BEFORE the current one would otherwise silently change what the object
 * shows, so the active index follows its item rather than its position.
 */
export function removeContentAt(config: AssetInteractionConfig | undefined, index: number): AssetInteractionConfig {
  const list = storedContents(config);
  if (index < 0 || index >= list.length) return commit(config, list, config?.activeIndex ?? 0);
  const next = list.filter((_, i) => i !== index);
  const active = config?.activeIndex ?? 0;
  return commit(config, next, index < active ? active - 1 : active);
}

/** Move an item to a new position, carrying the current selection with it. */
export function moveContent(config: AssetInteractionConfig | undefined, from: number, to: number): AssetInteractionConfig {
  const list = storedContents(config);
  const active = config?.activeIndex ?? 0;
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return commit(config, list, active);
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  // The active item is identified by WHICH item it is, not by its old slot.
  const activeItem = list[active];
  const nextActive = next.indexOf(activeItem);
  return commit(config, next, nextActive >= 0 ? nextActive : active);
}

/** Which item the object shows. */
export function setActiveContent(config: AssetInteractionConfig | undefined, index: number): AssetInteractionConfig {
  return commit(config, storedContents(config), index);
}

/**
 * Write the list back, always in canonical form.
 *
 * Drops the legacy `connection` once a list exists, so a document can never carry two
 * disagreeing answers — the exact class of bug that made Edit and Preview diverge in
 * M27B-1. An empty list clears the whole config rather than leaving `contents: []`, so
 * "nothing connected" has one representation.
 */
function commit(config: AssetInteractionConfig | undefined, list: ConnectedContent[], active: number): AssetInteractionConfig {
  const rest = { ...config };
  delete rest.connection;
  if (!list.length) {
    delete rest.contents;
    delete rest.activeIndex;
    return rest;
  }
  const clamped = Math.min(Math.max(Math.trunc(active) || 0, 0), list.length - 1);
  return { ...rest, contents: list, ...(clamped ? { activeIndex: clamped } : {}) };
}
