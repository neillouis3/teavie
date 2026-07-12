export type AnilistTrailerPayload = {
  id?: string | null;
  site?: string | null;
  thumbnail?: string | null;
};

/** Best YouTube embed URL from an AniList `trailer` field. */
export function pickAnilistYoutubeTrailerEmbedUrl(
  trailer: AnilistTrailerPayload | null | undefined
): string | null {
  if (!trailer) return null;
  const site = String(trailer.site ?? "").trim().toLowerCase();
  if (site !== "youtube") return null;
  const key = String(trailer.id ?? "").trim();
  if (!key) return null;
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(key)}?rel=0&modestbranding=1`;
}
