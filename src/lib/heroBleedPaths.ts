/** Routes whose hero extends under the fixed top nav. */
export const HERO_BLEED_PATHS = ["/explore", "/anime", "/kdrama"] as const;

const SHOW_DETAIL_HERO_RE = /^\/shows\/([^/]+)\/?$/;
const MOVIE_DETAIL_HERO_RE = /^\/movies\/([^/]+)\/?$/;

/** Show detail pages with a hero banner (excludes watch, all, admin). */
export function pathUsesShowDetailHeroBleed(pathname: string): boolean {
  const m = SHOW_DETAIL_HERO_RE.exec(pathname);
  if (!m) return false;
  const slug = m[1];
  if (slug === "all" || slug === "admin") return false;
  return true;
}

/** Movie detail pages with a hero banner (excludes watch, all). */
export function pathUsesMovieDetailHeroBleed(pathname: string): boolean {
  const m = MOVIE_DETAIL_HERO_RE.exec(pathname);
  if (!m) return false;
  const slug = m[1];
  if (slug === "all") return false;
  return true;
}

export function pathUsesHeroBleed(pathname: string): boolean {
  if (HERO_BLEED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  return pathUsesShowDetailHeroBleed(pathname) || pathUsesMovieDetailHeroBleed(pathname);
}

/** Fixed top nav height (`h-14`) — extend heroes by this much when bleeding under nav. */
export const NAV_BLEED_EXTEND = "3.5rem";
