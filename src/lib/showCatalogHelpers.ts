import {
  cumulativeTvEpisode,
  tmdbSeasonEpisodeFromAbsolute,
} from "@/lib/cumulativeTvEpisode";
import { imdbGenresFromAnimeSources } from "@/lib/imdbGenres";
import { tmdbImageUrl, catalogHeroImageUrl } from "@/lib/tmdbImage";
import {
  animeHeroBannerFromDoc,
  animePosterFromDoc,
  isAnimePortraitCoverUrl,
  isTmdbImagePath,
} from "@/lib/animePoster.js";
import {
  mergedSplitCourEpisodeCount,
  primaryMalForSplitCourMal,
  splitCourGroupForMal,
} from "@/lib/animeSplitCour.js";
import type { TmdbVideosPayload } from "@/lib/tmdbVideos";
import type { StreamServerId } from "@/contexts/streamingSourceContext";

export interface Season {
  season_number: number;
  episode_count: number;
  air_date?: string | null;
}

export interface Show {
  id: number | string;
  name: string;
  first_air_date: string;
  overview: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  vote_average: number;
  status: string;
  genres: { id: number; name: string }[];
  imdb_genres?: string[];
  omdb?: { genre?: string | null };
  origin_country?: string[];
  production_countries?: { iso_3166_1?: string; name?: string }[];
  production_companies?: { id?: number; name?: string }[];
  networks?: { id?: number; name?: string }[];
  studios?: { id?: number; name?: string }[];
  original_language?: string;
  homepage?: string | null;
  tagline?: string | null;
  content_ratings?: unknown;
  last_air_date?: string | null;
  episode_run_time?: number[] | null;
  created_by?: { id?: number; name?: string }[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: Season[];
  is_anime?: boolean;
  is_kdrama?: boolean;
  catalog_categories?: string[];
  anilist_id?: number | null;
  mal_id?: number | null;
  external_ids?: {
    mal_id?: number | null;
    anilist_id?: number | null;
    tmdb_id?: number | string | null;
    imdb_id?: string | null;
  } | null;
  /** TMDB season layout: when set on anime, picker uses these counts and embed uses same S/E as the UI. */
  tmdb_playback_seasons?: Season[];
  tmdb_id?: number | string | null;
  anilist?: {
    id?: number | null;
    siteUrl?: string | null;
    title?: {
      romaji?: string | null;
      english?: string | null;
      native?: string | null;
    };
    averageScore?: number | null;
    season?: string | null;
    seasonYear?: number | null;
    status?: string | null;
    format?: string | null;
    /** AniList total episode count (finished/airing cap); drives picker cap with TMDB season map. */
    episodes?: number | null;
    coverImage?: {
      color?: string | null;
      extraLarge?: string | null;
      large?: string | null;
      medium?: string | null;
    } | null;
    bannerImage?: string | null;
    trailer?: {
      id?: string | null;
      site?: string | null;
      thumbnail?: string | null;
    } | null;
  } | null;
  aggregate_credits?: unknown;
  videos?: TmdbVideosPayload;
}

export function isAnimeShowPage(show: Show, routeId: string): boolean {
  if (Boolean(show.is_anime)) return true;
  if (/^anime_/i.test(String(routeId).trim())) return true;
  if (show.anilist?.id != null) return true;
  if (show.anilist_id != null) return true;
  if (show.mal_id != null) return true;
  return false;
}

export function resolveTvHeroBannerUrl(show: Show): string | null {
  const backdrop = catalogHeroImageUrl(show.backdrop_path);
  return backdrop || null;
}

/** Best widescreen hero path when merging anime catalog + TMDB payloads. */
export function pickAnimeShowHeroBackdrop(
  show: Show,
  fallback?: Show | null
): string | null {
  const tmdbBackdrop = isTmdbImagePath(show.backdrop_path)
    ? show.backdrop_path
    : null;
  const fromFallback = fallback ? animeHeroBannerFromDoc(fallback) : null;
  const fromShow = animeHeroBannerFromDoc(show);
  return tmdbBackdrop || fromFallback || fromShow || null;
}

export function resolveShowDetailsBannerUrl(
  show: Show,
  routeId: string,
  posterUrl: string,
  fetchedAnimeBannerUrl: string | null
): string | null {
  if (isAnimeShowPage(show, routeId)) {
    const hero = resolveAnimeHeroBannerUrl(show, routeId, posterUrl);
    const fetched = fetchedAnimeBannerUrl?.trim();
    if (hero && !isAnimePortraitCoverUrl(hero)) return hero;
    if (fetched) return catalogHeroImageUrl(fetched) || fetched;
    return hero || posterUrl || null;
  }
  return resolveTvHeroBannerUrl(show);
}

export function resolveAnimeHeroBannerUrl(
  show: Show,
  routeId: string,
  posterUrl: string
): string | null {
  const doc = { ...show, id: show.id ?? routeId };
  const candidates = [
    show.anilist?.bannerImage,
    animeHeroBannerFromDoc(doc),
    isTmdbImagePath(show.backdrop_path) ? show.backdrop_path : null,
  ];

  for (const value of candidates) {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) continue;
    const url = catalogHeroImageUrl(raw);
    if (url) return url;
  }
  return null;
}

export function catalogAnilistId(
  doc: Pick<Show, "anilist_id" | "anilist"> | null | undefined
): number | null {
  if (!doc) return null;
  if (typeof doc.anilist_id === "number" && doc.anilist_id > 0) return doc.anilist_id;
  if (typeof doc.anilist?.id === "number" && doc.anilist.id > 0) return doc.anilist.id;
  return null;
}

export function isKdramaShow(show: Show | null | undefined): boolean {
  if (!show || show.is_anime) return false;
  if (show.is_kdrama === true) return true;
  if (Array.isArray(show.catalog_categories) && show.catalog_categories.includes("kdrama")) {
    return true;
  }
  const ko = show.original_language === "ko";
  const kr = Array.isArray(show.origin_country) && show.origin_country.includes("KR");
  return ko && kr;
}

/**
 * MAL id from `/shows/anime_{malId}` or doc fields — for AniList metadata merge and related rails.
 */
export function malIdFromAnimeCatalogRouteId(routeId: string): number | null {
  const m = /^anime_(\d+)$/i.exec(String(routeId ?? "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function catalogMalIdForAnilistApi(
  doc: Pick<Show, "mal_id" | "external_ids"> | null | undefined,
  routeId: string
): number | null {
  const fromRoute = malIdFromAnimeCatalogRouteId(routeId);
  if (fromRoute != null) return fromRoute;
  if (typeof doc?.mal_id === "number" && doc.mal_id > 0) return doc.mal_id;
  const ext = doc?.external_ids?.mal_id;
  if (typeof ext === "number" && ext > 0) return ext;
  return null;
}

export function catalogImdbId(
  doc: Pick<Show, "external_ids"> & { imdb_id?: string | null } | null | undefined
): string | null {
  if (!doc) return null;
  const candidates = [
    typeof doc.imdb_id === "string" ? doc.imdb_id : null,
    doc.external_ids?.imdb_id,
  ];
  for (const raw of candidates) {
    const id = String(raw ?? "").trim();
    if (/^tt\d+$/i.test(id)) return id;
  }
  return null;
}

/** AniList-reported total episodes (null while unknown / airing). */
export function anilistEpisodeCap(show: Show | null | undefined): number | null {
  const e = show?.anilist?.episodes;
  if (typeof e !== "number" || !Number.isFinite(e) || e <= 0) return null;
  return e;
}

/** Catalog / AniList / IMDb-adjacent episode total for anime UI + picker. */
export function catalogAnimeEpisodeCount(
  show: Show | null | undefined,
  routeId?: string
): number | null {
  const routeMal = routeId ? malIdFromAnimeCatalogRouteId(routeId) : null;
  const group = splitCourGroupForMal(routeMal ?? show?.mal_id);
  if (
    group &&
    primaryMalForSplitCourMal(routeMal ?? show?.mal_id) === group.primaryMalId
  ) {
    return mergedSplitCourEpisodeCount(group);
  }
  const fromAni = anilistEpisodeCap(show);
  if (fromAni != null) return fromAni;
  const fromDoc = show?.number_of_episodes;
  if (typeof fromDoc === "number" && Number.isFinite(fromDoc) && fromDoc > 0) {
    return fromDoc;
  }
  return null;
}

export function applyAnimeCatalogEpisodeLayout(show: Show, routeId?: string): Show {
  if (!show.is_anime) return show;
  const eps = catalogAnimeEpisodeCount(show, routeId);
  if (eps == null || eps <= 0) return show;
  return {
    ...show,
    seasons: [{ season_number: 1, episode_count: eps }],
    number_of_seasons: 1,
    number_of_episodes: eps,
  };
}

/** Prefer AniList/catalog episodes for anime UI; fall back to flattened TMDB totals. */
export function finalizeAnimeShowForUi(show: Show, routeId?: string): Show {
  if (!show.is_anime) return show;
  const withCatalog = applyAnimeCatalogEpisodeLayout(show, routeId);
  if (catalogAnimeEpisodeCount(show, routeId) != null) return withCatalog;
  return withAnimeFlatEpisodeLayout(withCatalog);
}

export function tmdbTvIdForVideos(show: Show | null | undefined): number | null {
  const candidates = [
    show?.tmdb_id,
    show?.external_ids?.tmdb_id,
  ];
  for (const raw of candidates) {
    const n = typeof raw === "string" ? Number(raw) : raw;
    if (typeof n === "number" && Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Anime routes skip /api/tv/details, so pull the trailer straight from TMDB videos. */
export async function attachAnimeTrailerVideos(show: Show): Promise<Show> {
  if (!show.is_anime || show.videos || show.anilist?.trailer?.id) return show;
  const tmdbId = tmdbTvIdForVideos(show);
  if (tmdbId == null) return show;
  try {
    const res = await fetch(`/api/tv/details?id=${tmdbId}`);
    if (!res.ok) return show;
    const data = (await res.json()) as { videos?: TmdbVideosPayload };
    if (data?.videos) return { ...show, videos: data.videos };
  } catch {
    /* ignore trailer fetch errors */
  }
  return show;
}

/** Map catalog/anilist episode index → TMDB season/episode for embed players. */
export function resolveAnimePlayerCoords(
  show: Show,
  selectedSeason: number,
  selectedEpisode: number
): { season: number; episode: number } {
  const uiSeasons = tmdbSeasonsWithEpisodes(show.seasons);
  const abs =
    uiSeasons.length <= 1 && selectedSeason <= 1
      ? Math.max(1, selectedEpisode)
      : cumulativeTvEpisode(show.seasons, selectedSeason, selectedEpisode);
  const playback = tmdbSeasonsWithEpisodes(show.tmdb_playback_seasons);
  if (playback.length === 0) {
    return { season: Math.max(1, selectedSeason), episode: abs };
  }
  if (playback.length === 1) {
    return { season: playback[0].season_number, episode: abs };
  }
  return tmdbSeasonEpisodeFromAbsolute(playback, abs);
}

/** Page / tab title: AniList English → Romaji → Native when linked anime; else TMDB/catalog `name`. */
export function showDisplayTitle(show: Show | null | undefined): string {
  if (!show) return "";
  if (Boolean(show.is_anime) && catalogAnilistId(show) != null) {
    const t = show.anilist?.title;
    if (t) {
      const fromAni = [t.english, t.romaji, t.native]
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .find((s) => s.length > 0);
      if (fromAni) return fromAni;
    }
  }
  return String(show.name ?? "").trim();
}

export type AnilistMediaPayload = {
  id: number;
  idMal?: number | null;
  siteUrl?: string | null;
  /** Total episodes on AniList (may be null while airing). */
  episodes?: number | null;
  overview?: string;
  genres?: string[];
  averageScore?: number | null;
  status?: string | null;
  format?: string | null;
  first_air_date?: string | null;
  title?: { romaji?: string | null; english?: string | null; native?: string | null };
  coverImage?: {
    color?: string | null;
    extraLarge?: string | null;
    large?: string | null;
    medium?: string | null;
  } | null;
  bannerImage?: string | null;
  trailer?: {
    id?: string | null;
    site?: string | null;
    thumbnail?: string | null;
  } | null;
};

export function tmdbSeasonsWithEpisodes(seasons: Season[] | undefined): Season[] {
  return (seasons ?? []).filter(
    (s) => s.season_number >= 1 && typeof s.episode_count === "number" && s.episode_count > 0
  );
}

export function catalogTodayYmdUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Drop TMDB seasons whose `air_date` is in the future (keep unknown / empty air_date). */
export function filterReleasedSeasons(seasons: Season[] | undefined, todayYmd: string): Season[] | undefined {
  if (!seasons?.length) return seasons;
  const next = seasons.filter((s) => {
    if ((s.season_number ?? 0) < 1) return false;
    const ad = String(s.air_date ?? "").trim();
    if (ad.length < 10) return true;
    return ad <= todayYmd;
  });
  return next.length ? next : seasons;
}

/** Flatten TMDB multi-season totals when catalog/anilist episode count is unavailable. */
export function withAnimeFlatEpisodeLayout(show: Show): Show {
  if (!show.is_anime) return show;
  const source = tmdbSeasonsWithEpisodes(
    show.tmdb_playback_seasons?.length
      ? show.tmdb_playback_seasons
      : show.seasons
  );
  if (source.length === 0) return show;
  const total = source.reduce(
    (acc, s) => acc + (typeof s.episode_count === "number" ? s.episode_count : 0),
    0
  );
  if (total <= 0) return show;
  if (
    source.length === 1 &&
    source[0].season_number === 1 &&
    (source[0].episode_count ?? 0) === total
  ) {
    return show;
  }
  return {
    ...show,
    seasons: [{ season_number: 1, episode_count: total }],
    number_of_seasons: 1,
    number_of_episodes: total,
  };
}

export function mapAnilistStatus(s: string | null | undefined): string {
  if (!s) return "Unknown";
  const m: Record<string, string> = {
    FINISHED: "Finished",
    RELEASING: "Returning Series",
    NOT_YET_RELEASED: "Not Yet Aired",
    CANCELLED: "Canceled",
    HIATUS: "On Hiatus",
  };
  return m[s] ?? s;
}

export function mergeAnilistIntoShow(
  base: Show,
  ani: AnilistMediaPayload,
  fallback: Show | null
): Show {
  const next: Show = { ...base };
  const desc = (ani.overview || "").trim();
  if (desc && (!next.overview || next.overview.trim().length < 40)) {
    next.overview = desc;
  }
  if (Array.isArray(ani.genres) && ani.genres.length) {
    const fromAni = imdbGenresFromAnimeSources({
      id: next.id,
      is_anime: next.is_anime ?? true,
      anilist: { genres: ani.genres },
    });
    if (fromAni.length) next.imdb_genres = fromAni;
  }
  if (ani.averageScore != null) {
    const tmdbScore = Number(next.vote_average);
    if (!Number.isFinite(tmdbScore) || tmdbScore <= 0) {
      next.vote_average = Math.round((ani.averageScore / 10) * 10) / 10;
    }
  }
  if (ani.first_air_date && !next.first_air_date) {
    next.first_air_date = ani.first_air_date;
  }
  if (ani.status) {
    next.status = mapAnilistStatus(ani.status);
  }
  const displayTitle =
    ani.title?.english || ani.title?.romaji || ani.title?.native;
  if (displayTitle && (!next.name || next.name === "Untitled")) {
    next.name = displayTitle;
  }
  next.anilist_id = ani.id;
  next.anilist = {
    ...next.anilist,
    id: ani.id,
    siteUrl: ani.siteUrl ?? next.anilist?.siteUrl ?? null,
    title: {
      romaji: ani.title?.romaji ?? next.anilist?.title?.romaji ?? null,
      english: ani.title?.english ?? next.anilist?.title?.english ?? null,
      native: ani.title?.native ?? next.anilist?.title?.native ?? null,
    },
    format: ani.format ?? next.anilist?.format ?? null,
    averageScore: ani.averageScore ?? next.anilist?.averageScore ?? null,
    episodes:
      typeof ani.episodes === "number" && ani.episodes > 0
        ? ani.episodes
        : next.anilist?.episodes ?? null,
    coverImage: ani.coverImage ?? next.anilist?.coverImage ?? null,
    bannerImage: ani.bannerImage ?? next.anilist?.bannerImage ?? null,
    trailer: ani.trailer ?? next.anilist?.trailer ?? null,
  };

  if (next.is_anime || fallback?.is_anime || /^anime_/i.test(String(next.id ?? ""))) {
    next.is_anime = true;
    const posterFromAni =
      ani.coverImage?.extraLarge ||
      ani.coverImage?.large ||
      ani.coverImage?.medium ||
      null;
    const bannerFromAni = ani.bannerImage || posterFromAni;
    if (posterFromAni) next.poster_path = posterFromAni;
    if (bannerFromAni) next.backdrop_path = bannerFromAni;
  }

  // Live-action TV: keep TMDB season/episode structure.
  const goodTmdb = tmdbSeasonsWithEpisodes(next.seasons);
  if (!next.is_anime && goodTmdb.length > 0) {
    if (typeof next.number_of_episodes !== "number" || next.number_of_episodes <= 0) {
      next.number_of_episodes = goodTmdb.reduce((acc, s) => acc + s.episode_count, 0);
    }
    if (typeof next.number_of_seasons !== "number" || next.number_of_seasons <= 0) {
      next.number_of_seasons = goodTmdb.length;
    }
    return next;
  }

  const eps =
    (typeof ani.episodes === "number" && ani.episodes > 0 ? ani.episodes : null) ??
    (typeof next.number_of_episodes === "number" && next.number_of_episodes > 0
      ? next.number_of_episodes
      : null) ??
    (typeof fallback?.number_of_episodes === "number" && fallback.number_of_episodes > 0
      ? fallback.number_of_episodes
      : null);

  if (eps != null && eps > 0) {
    next.seasons = [{ season_number: 1, episode_count: eps }];
    next.number_of_seasons = 1;
    next.number_of_episodes = eps;
  }

  return next;
}

export async function fetchAnilistAndMerge(
  base: Show,
  fallback: Show | null,
  routeId?: string
): Promise<Show> {
  const malFromRoute = routeId ? malIdFromAnimeCatalogRouteId(routeId) : null;
  const aid =
    typeof base.anilist_id === "number" && base.anilist_id > 0
      ? base.anilist_id
      : typeof base.anilist?.id === "number" && base.anilist.id > 0
        ? base.anilist.id
        : typeof fallback?.anilist_id === "number" && fallback.anilist_id > 0
          ? fallback.anilist_id
          : typeof fallback?.anilist?.id === "number" && fallback.anilist.id > 0
            ? fallback.anilist.id
            : null;
  const malRaw =
    malFromRoute ??
    (typeof base.mal_id === "number" && base.mal_id > 0
      ? base.mal_id
      : typeof base.external_ids?.mal_id === "number" && base.external_ids.mal_id > 0
        ? base.external_ids.mal_id
        : typeof fallback?.mal_id === "number" && fallback.mal_id > 0
          ? fallback.mal_id
          : typeof fallback?.external_ids?.mal_id === "number" &&
              fallback.external_ids.mal_id > 0
            ? fallback.external_ids.mal_id
            : null);

  let url: string | null = null;
  if (aid != null) url = `/api/anilist/media?anilistId=${aid}`;
  else if (malRaw != null) url = `/api/anilist/media?idMal=${malRaw}`;
  else return base.is_anime ? finalizeAnimeShowForUi(base, routeId) : base;

  try {
    const res = await fetch(url);
    if (!res.ok) return base.is_anime ? finalizeAnimeShowForUi(base, routeId) : base;
    const ani = (await res.json()) as AnilistMediaPayload & { error?: string };
    if (!ani || typeof ani !== "object" || "error" in ani) {
      return base.is_anime ? finalizeAnimeShowForUi(base, routeId) : base;
    }
    if (typeof ani.id !== "number") {
      return base.is_anime ? finalizeAnimeShowForUi(base, routeId) : base;
    }
    const merged = mergeAnilistIntoShow(base, ani, fallback);
    return base.is_anime || merged.is_anime ? finalizeAnimeShowForUi(merged, routeId) : merged;
  } catch {
    return base.is_anime ? finalizeAnimeShowForUi(base, routeId) : base;
  }
}

export type ShowServerKey = StreamServerId;

export type ShowTemplateViewMode = "details" | "watch" | "episodes";

export function buildShowWatchHref(
  catalogId: string,
  options: {
    season: number;
    episode: number;
    party?: string | null;
  }
): string {
  const params = new URLSearchParams();
  if (options.season !== 1 || options.episode !== 1) {
    params.set("season", String(options.season));
    params.set("episode", String(options.episode));
  }
  if (options.party) params.set("party", options.party);
  const base = `/shows/${encodeURIComponent(catalogId)}/watch`;
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

export function buildShowEpisodesHref(catalogId: string): string {
  return `/shows/${encodeURIComponent(catalogId)}/episodes`;
}
