// Pure URL → embeddable-player parsing for the video object. Supports YouTube
// and Vimeo; anything else (including a local/placeholder URL) returns null so
// the player panel falls back to a placeholder. No network calls — just regex.

export type VideoProvider = "youtube" | "vimeo";
export type VideoEmbed = { provider: VideoProvider; embedUrl: string };

/**
 * Resolve a watch/share URL to an embeddable iframe URL.
 * Returns null for unknown or empty input (caller shows a placeholder).
 */
export function videoEmbed(url?: string | null): VideoEmbed | null {
  if (!url) return null;
  const value = url.trim();
  if (!value) return null;

  const youtube = value.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );
  if (youtube) return { provider: "youtube", embedUrl: `https://www.youtube.com/embed/${youtube[1]}` };

  const vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${vimeo[1]}` };

  return null;
}
