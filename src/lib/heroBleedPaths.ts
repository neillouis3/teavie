import { EXPLORE_HOME } from "./routes";
import { NAV_BLEED_EXTEND_REM } from "./navLayout";

/** Routes whose hero extends under the fixed top nav (exact match or nested subpaths). */
export const HERO_BLEED_PATHS = [EXPLORE_HOME] as const;

/** Hub routes with a hero banner, but only the exact route — nested catalog pages
 *  like `/anime/all` must NOT inherit this. */
export const HERO_BLEED_EXACT_PATHS = ["/anime", "/kdrama"] as const;

const SHOW_DETAIL_HERO_RE = /^\/shows\/([^/]+)\/?$/;
const SHOW_EPISODES_HERO_RE = /^\/shows\/([^/]+)\/episodes\/?$/;
const MOVIE_DETAIL_HERO_RE = /^\/movies\/([^/]+)\/?$/;
const ANIME_DETAIL_HERO_RE = /^\/anime\/([^/]+)\/?$/;
const KDRAMA_DETAIL_HERO_RE = /^\/kdrama\/([^/]+)\/?$/;
const GENRE_SPOTLIGHT_HERO_RE = /^\/genre\/[^/]+\/?$/;

/** Genre slug pages with a full-bleed spotlight hero (excludes `/genres` index). */
export function pathUsesGenreSpotlightHeroBleed(pathname: string): boolean {
  return GENRE_SPOTLIGHT_HERO_RE.test(pathname);
}

/** Show episodes pages with a full-bleed blurred backdrop (excludes watch, all, admin). */
export function pathUsesShowEpisodesHeroBleed(pathname: string): boolean {
  const m = SHOW_EPISODES_HERO_RE.exec(pathname);
  if (!m) return false;
  const slug = m[1];
  if (slug === "all" || slug === "admin") return false;
  return true;
}

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

/** Anime detail pages with a hero banner (excludes the `/anime/all` catalog). */
export function pathUsesAnimeDetailHeroBleed(pathname: string): boolean {
  const m = ANIME_DETAIL_HERO_RE.exec(pathname);
  if (!m) return false;
  const slug = m[1];
  if (slug === "all") return false;
  return true;
}

/** K-Drama detail pages with a hero banner (excludes the `/kdrama/all` catalog). */
export function pathUsesKdramaDetailHeroBleed(pathname: string): boolean {
  const m = KDRAMA_DETAIL_HERO_RE.exec(pathname);
  if (!m) return false;
  const slug = m[1];
  if (slug === "all") return false;
  return true;
}

export function pathUsesHeroBleed(pathname: string): boolean {
  if (HERO_BLEED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  if (HERO_BLEED_EXACT_PATHS.some((p) => pathname === p)) {
    return true;
  }
  return (
    pathUsesShowEpisodesHeroBleed(pathname) ||
    pathUsesShowDetailHeroBleed(pathname) ||
    pathUsesMovieDetailHeroBleed(pathname) ||
    pathUsesAnimeDetailHeroBleed(pathname) ||
    pathUsesKdramaDetailHeroBleed(pathname) ||
    pathUsesGenreSpotlightHeroBleed(pathname)
  );
}

/** Fixed top nav height (`h-14`) — extend heroes by this much when bleeding under nav. */
export const NAV_BLEED_EXTEND = NAV_BLEED_EXTEND_REM;