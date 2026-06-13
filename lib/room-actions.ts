import type { ContactSocial, GalleryImage, RoomActionData, RoomActionType } from "@/lib/types";

// Pure helpers that turn an object's stored `actionData` into the shape each
// visitor panel renders. They normalise/validate input (drop empties, fix up
// URLs) so a half-filled object degrades gracefully instead of breaking a click.

/** Prefix a bare host with https:// so it is a valid, openable URL. */
export function withHttp(url: string): string {
  const value = url.trim();
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/** Bare hostname (no www.) for favicons/labels, or null if not a URL. */
export function hostname(url?: string | null): string | null {
  if (!url || !url.trim()) return null;
  try {
    return new URL(withHttp(url)).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** A favicon preview URL for a link card, or null when there is no host. */
export function faviconUrl(url?: string | null): string | null {
  const host = hostname(url);
  return host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : null;
}

/** Gallery images with a real source (empty rows are dropped). */
export function galleryImages(data?: RoomActionData): GalleryImage[] {
  return (data?.images ?? []).filter((image): image is GalleryImage => !!image && typeof image.src === "string" && image.src.trim().length > 0);
}

export type ProductCard = { title: string; price?: string; image?: string; url?: string };

/** A product card, or null when there is nothing meaningful to show. */
export function productCard(data?: RoomActionData): ProductCard | null {
  if (!data) return null;
  const title = (data.title ?? "").trim();
  const price = (data.price ?? "").trim();
  const image = (data.image ?? "").trim();
  const url = (data.url ?? "").trim();
  if (!title && !price && !image && !url) return null;
  return { title: title || "Untitled item", price: price || undefined, image: image || undefined, url: url ? withHttp(url) : undefined };
}

export type ContactMethod = { type: "email" | "website" | "phone" | "social"; label: string; value: string; href: string };

/** All contact methods present on an object, normalised to clickable hrefs. */
export function contactMethods(data?: RoomActionData): ContactMethod[] {
  const out: ContactMethod[] = [];
  if (!data) return out;
  const email = data.email?.trim();
  if (email) out.push({ type: "email", label: "Email", value: email, href: `mailto:${email}` });
  const website = data.website?.trim();
  if (website) out.push({ type: "website", label: "Website", value: hostname(website) ?? website, href: withHttp(website) });
  const phone = data.phone?.trim();
  if (phone) out.push({ type: "phone", label: "Phone", value: phone, href: `tel:${phone.replace(/[^+\d]/g, "")}` });
  for (const social of data.socials ?? []) {
    const url = social?.url?.trim();
    if (!url) continue;
    const label = social.label?.trim() || hostname(url) || "Link";
    out.push({ type: "social", label, value: label, href: withHttp(url) });
  }
  return out;
}

/**
 * Whether an object's action has enough data to actually do something. Used to
 * keep an unconfigured object inert (no broken click) rather than erroring.
 * `guestbook`, `profile`, and `collection` need no stored data; `none` never acts.
 */
export function hasActionData(actionType: RoomActionType, data?: RoomActionData): boolean {
  switch (actionType) {
    case "none":
      return false;
    case "guestbook":
    case "collection":
    case "profile":
      return true;
    case "gallery":
      return galleryImages(data).length > 0;
    case "product":
      return productCard(data) !== null;
    case "contact":
      return contactMethods(data).length > 0;
    case "link":
    case "video":
    case "booking":
      return !!data?.url?.trim();
    default:
      return false;
  }
}

export type { ContactSocial };
