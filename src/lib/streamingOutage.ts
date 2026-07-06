/** When true, show a notice that TMDB movie/TV streaming is temporarily unavailable. */
export const CATALOG_STREAMING_OUTAGE_ACTIVE = true;

const ANIME_SHOW_ID_RE = /^anime_/i;

function showRouteId(pathname: string): string | null {
  const match = /^\/shows\/([^/]+)/.exec(pathname);
  return match?.[1] ?? null;
}

/** Routes where movie/TV streaming outage messaging should appear (anime excluded). */
export function pathShowsCatalogStreamingOutage(pathname: string): boolean {
  if (!CATALOG_STREAMING_OUTAGE_ACTIVE) return false;

  if (pathname === "/" || pathname === "/explore") return true;
  if (pathname.startsWith("/anime")) return false;
  if (pathname.startsWith("/sports")) return false;
  if (pathname.startsWith("/movies")) return true;
  if (pathname.startsWith("/kdrama")) return true;
  if (pathname.startsWith("/search")) return true;
  if (pathname.startsWith("/genres") || pathname.startsWith("/genre/")) return true;
  if (pathname === "/settings") return true;

  if (pathname.startsWith("/shows")) {
    const id = showRouteId(pathname);
    if (!id || id === "all" || id === "admin") return true;
    return !ANIME_SHOW_ID_RE.test(id);
  }

  return false;
}
