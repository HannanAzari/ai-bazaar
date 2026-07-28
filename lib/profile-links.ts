import type { NestProfile, NestSocials, ProfileLink } from "@/lib/nest-profile-store";

// M20 — one place that turns a profile into displayable links. Creators may add ANY
// platform (Spotify, Steam, Discord, Patreon, a shop…), so nothing is hard-coded; the legacy
// fixed four (website/github/twitter/youtube) are still read so existing profiles keep working.

export type DisplayLink = { label: string; href: string };

const ensureUrl = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v.replace(/^@/, "")}`);

/** A readable label from a URL when the creator didn't give one ("open.spotify.com" → "Spotify"). */
export function labelFromUrl(url: string): string {
  try {
    const host = new URL(ensureUrl(url)).hostname.replace(/^www\./, "");
    const core = host.split(".")[0] ?? host;
    return core.charAt(0).toUpperCase() + core.slice(1);
  } catch {
    return "Link";
  }
}

function fromSocials(socials?: NestSocials): DisplayLink[] {
  if (!socials) return [];
  const out: DisplayLink[] = [];
  if (socials.website) out.push({ label: "Website", href: ensureUrl(socials.website) });
  if (socials.github) out.push({ label: "GitHub", href: ensureUrl(socials.github.includes("/") ? socials.github : `github.com/${socials.github.replace(/^@/, "")}`) });
  if (socials.twitter) out.push({ label: "Twitter", href: ensureUrl(socials.twitter.includes("/") ? socials.twitter : `x.com/${socials.twitter.replace(/^@/, "")}`) });
  if (socials.youtube) out.push({ label: "YouTube", href: ensureUrl(socials.youtube) });
  return out;
}

function fromLinks(links?: ProfileLink[]): DisplayLink[] {
  return (links ?? [])
    .filter((l) => l.url?.trim())
    .map((l) => ({ label: l.label?.trim() || labelFromUrl(l.url), href: ensureUrl(l.url.trim()) }));
}

/** Every link a creator has, legacy + custom, de-duplicated by destination. */
export function profileLinks(profile?: Pick<NestProfile, "socials" | "links"> | null): DisplayLink[] {
  if (!profile) return [];
  const all = [...fromSocials(profile.socials), ...fromLinks(profile.links)];
  const seen = new Set<string>();
  return all.filter((l) => (seen.has(l.href) ? false : (seen.add(l.href), true)));
}
