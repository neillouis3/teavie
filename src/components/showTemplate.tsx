'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@heroui/react";
import ShowPlayer from "./showPlayer";
import AnimePlayer from "./animePlayer";
import MoviePlayer from "./moviePlayer";
import YouMightLike from "./youMightLike";
import AnimeShowRails from "./animeShowRails";
import {
  cumulativeTvEpisode,
  tmdbSeasonEpisodeFromAbsolute,
} from "@/lib/cumulativeTvEpisode";
import ShowEpisodePicker, {
  ShowEpisodePickerControls,
  ShowEpisodePickerList,
  ShowEpisodePickerProvider,
  ShowWatchPlayerHeading,
  SHOW_VIDEO_PLAYER_ID,
} from "@/components/show/ShowEpisodePicker";
import {
  useStreamingSource,
  type StreamServerId,
} from "@/contexts/streamingSourceContext";
import { useAnimeAudio } from "@/contexts/animeAudioContext";
import {
  formatWatchEpKey,
  loadWatchProgress,
  saveWatchProgress,
  saveEpisodePlaybackPosition,
  loadEpisodePlaybackPosition,
} from "@/lib/watchProgress";
import type { VideasyProgressMessage } from "@/lib/videasyProgress";
import type { MegaPlayMessage } from "@/lib/megaPlayProgress";
import { recordMovieInWatchHistory, touchWatchHistory, WATCH_HISTORY_MIN_PLAY_SECONDS } from "@/lib/watchHistory";
import {
  saveMoviePlaybackPosition,
} from "@/lib/movieWatchProgress";
import WatchLaterButton from "@/components/watchLater/WatchLaterButton";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import {
  catalogGenresForDisplay,
} from "@/components/ui/catalogDetailColumns";
import {
  buildExtendedShowInfoLines,
  buildShowAlternateTitles,
  buildShowDetailLinks,
  buildShowDetailStatPills,
} from "@/lib/showDetailsMeta";
import CatalogMediaPanel from "@/components/ui/catalogMediaPanel";
import WatchPageSkeleton from "@/components/ui/watchPageSkeleton";
import CatalogDetailsSkeleton from "@/components/ui/catalogDetailsSkeleton";
import { PlayerEmbedSkeleton, PLAYER_SHELL_CLASS } from "@/components/ui/playerEmbedSkeleton";
import CatalogComingSoon from "@/components/ui/catalogComingSoon";
import CatalogUnavailable from "@/components/ui/catalogUnavailable";
import { usCertificationFromDoc } from "@/lib/mapContentDocToItem";
import { imdbGenresFromAnimeSources } from "@/lib/imdbGenres";
import { tmdbImageUrl } from "@/lib/tmdbImage";
import {
  shouldPruneTvAnimeWithoutAnilist,
  showUnavailableReasonForDoc,
} from "@/lib/tvJpAnimePrune";
import type { GuestSyncPayload } from "@/lib/teaPartySync";
import { PARTY_HOST_BROADCAST_MS } from "@/lib/teaPartySync";
import { useWatchParty } from "@/hooks/useWatchParty";
import { useRegisterWatchPartyNav } from "@/hooks/useRegisterWatchPartyNav";
import { animeBackdropFromDoc, animePosterFromDoc } from "@/lib/animePoster.js";
import {
  mergedSplitCourEpisodeCount,
  primaryMalForSplitCourMal,
  splitCourGroupForMal,
  normalizeSplitCourMalEpisode,
} from "@/lib/animeSplitCour.js";
import { useTmdbTitleLogo } from "@/hooks/useTmdbTitleLogo";
import {
  animeReleaseDateYmdFromDoc,
  catalogTvPremiered,
} from "@/lib/animeRelease.js";
import MovieTrailerEmbed from "@/components/movie/MovieTrailerEmbed";
import MovieCreditsStrip from "@/components/movie/MovieCreditsStrip";
import ShowDetailsHero, {
  SHOW_DETAILS_HERO_OVERLAP,
} from "@/components/show/ShowDetailsHero";
import {
  pickYoutubeTrailerEmbedUrl,
  type TmdbVideosPayload,
} from "@/lib/tmdbVideos";
import { pickAnilistYoutubeTrailerEmbedUrl } from "@/lib/anilistTrailer";
import { SHOW_CONTENT_INSET_X } from "@/lib/contentInset";

interface Season {
  season_number: number;
  episode_count: number;
  air_date?: string | null;
}

interface Show {
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

function isAnimeShowPage(show: Show, routeId: string): boolean {
  if (Boolean(show.is_anime)) return true;
  if (/^anime_/i.test(String(routeId).trim())) return true;
  if (show.anilist?.id != null) return true;
  if (show.anilist_id != null) return true;
  if (show.mal_id != null) return true;
  return false;
}

function resolveTvHeroBannerUrl(show: Show): string | null {
  const backdrop = tmdbImageUrl(show.backdrop_path);
  return backdrop || null;
}

function resolveShowDetailsBannerUrl(
  show: Show,
  routeId: string,
  posterUrl: string,
  fetchedAnimeBannerUrl: string | null
): string | null {
  if (isAnimeShowPage(show, routeId)) {
    return (
      resolveAnimeHeroBannerUrl(show, routeId, posterUrl) ||
      fetchedAnimeBannerUrl ||
      posterUrl ||
      null
    );
  }
  return resolveTvHeroBannerUrl(show);
}

function resolveAnimeHeroBannerUrl(
  show: Show,
  routeId: string,
  posterUrl: string
): string | null {
  const doc = { ...show, id: show.id ?? routeId };
  const candidates = [
    show.anilist?.bannerImage,
    animeBackdropFromDoc(doc),
    animePosterFromDoc(doc),
    show.anilist?.coverImage?.extraLarge,
    show.anilist?.coverImage?.large,
    show.backdrop_path,
    show.poster_path,
    posterUrl,
  ];

  for (const value of candidates) {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) continue;
    const url = tmdbImageUrl(raw) || raw;
    if (url) return url;
  }
  return null;
}

function catalogAnilistId(
  doc: Pick<Show, "anilist_id" | "anilist"> | null | undefined
): number | null {
  if (!doc) return null;
  if (typeof doc.anilist_id === "number" && doc.anilist_id > 0) return doc.anilist_id;
  if (typeof doc.anilist?.id === "number" && doc.anilist.id > 0) return doc.anilist.id;
  return null;
}

function isKdramaShow(show: Show | null | undefined): boolean {
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
function malIdFromAnimeCatalogRouteId(routeId: string): number | null {
  const m = /^anime_(\d+)$/i.exec(String(routeId ?? "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function catalogMalIdForAnilistApi(
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

function catalogImdbId(
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
function anilistEpisodeCap(show: Show | null | undefined): number | null {
  const e = show?.anilist?.episodes;
  if (typeof e !== "number" || !Number.isFinite(e) || e <= 0) return null;
  return e;
}

/** Catalog / AniList / IMDb-adjacent episode total for anime UI + picker. */
function catalogAnimeEpisodeCount(
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

function applyAnimeCatalogEpisodeLayout(show: Show, routeId?: string): Show {
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
function finalizeAnimeShowForUi(show: Show, routeId?: string): Show {
  if (!show.is_anime) return show;
  const withCatalog = applyAnimeCatalogEpisodeLayout(show, routeId);
  if (catalogAnimeEpisodeCount(show, routeId) != null) return withCatalog;
  return withAnimeFlatEpisodeLayout(withCatalog);
}

function tmdbTvIdForVideos(show: Show | null | undefined): number | null {
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
async function attachAnimeTrailerVideos(show: Show): Promise<Show> {
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
function resolveAnimePlayerCoords(
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
function showDisplayTitle(show: Show | null | undefined): string {
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

type AnilistMediaPayload = {
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

function tmdbSeasonsWithEpisodes(seasons: Season[] | undefined): Season[] {
  return (seasons ?? []).filter(
    (s) => s.season_number >= 1 && typeof s.episode_count === "number" && s.episode_count > 0
  );
}

function catalogTodayYmdUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Drop TMDB seasons whose `air_date` is in the future (keep unknown / empty air_date). */
function filterReleasedSeasons(seasons: Season[] | undefined, todayYmd: string): Season[] | undefined {
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
function withAnimeFlatEpisodeLayout(show: Show): Show {
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

function mapAnilistStatus(s: string | null | undefined): string {
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

function mergeAnilistIntoShow(
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

async function fetchAnilistAndMerge(
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

export type ShowTemplateViewMode = "details" | "watch";

function buildShowWatchHref(
  catalogId: string,
  options: {
    season: number;
    episode: number;
    party?: string | null;
  }
): string {
  const params = new URLSearchParams();
  if (options.season > 1) params.set("season", String(options.season));
  if (options.episode > 1) params.set("episode", String(options.episode));
  if (options.party) params.set("party", options.party);
  const base = `/shows/${encodeURIComponent(catalogId)}/watch`;
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

export default function ShowTemplate({
  id,
  adminKey,
  adminPreview = false,
  viewMode = "details",
}: {
  id: string;
  adminKey?: string;
  adminPreview?: boolean;
  viewMode?: ShowTemplateViewMode;
}) {
  const { server } = useStreamingSource();
  const { audio: animeAudio } = useAnimeAudio();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [show, setShow] = useState<Show | null>(null);
  const [resolvedPlayerId, setResolvedPlayerId] = useState<string>(id);
  const [loading, setLoading] = useState(true);
  /** TMDB movie id for anime films (AniList format MOVIE/MUSIC), resolved via /api/anime/resolve-movie. */
  const [animeMovieTmdbId, setAnimeMovieTmdbId] = useState<string | null>(null);
  const [animeMovieResolving, setAnimeMovieResolving] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [pickerEpisodesLoading, setPickerEpisodesLoading] = useState(true);
  const [pickerPlayableCount, setPickerPlayableCount] = useState(0);
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(
    () => new Set()
  );
  const [progressHydrated, setProgressHydrated] = useState(false);
  const [showUnavailableReason, setShowUnavailableReason] = useState<
    "content_policy" | "not_found" | "unauthorized" | null
  >(null);
  const [adminBypassActive, setAdminBypassActive] = useState(false);
  const [playerStartSeconds, setPlayerStartSeconds] = useState(0);
  const [playerEpoch, setPlayerEpoch] = useState(0);
  const [fetchedBannerUrl, setFetchedBannerUrl] = useState<string | null>(null);
  const progressAppliedForIdRef = useRef<string | null>(null);
  const partyPlaybackBroadcastRef = useRef(0);
  const lastPartyEpRef = useRef<string | null>(null);
  const titleLogoId =
    animeMovieTmdbId ??
    (/^\d+$/.test(String(resolvedPlayerId)) ? String(resolvedPlayerId) : null);
  const titleLogoPath = useTmdbTitleLogo(
    animeMovieTmdbId ? "movie" : "tv",
    titleLogoId
  );

  useEffect(() => {
    progressAppliedForIdRef.current = null;
    setProgressHydrated(false);
    setShowUnavailableReason(null);
    setAdminBypassActive(false);
    setPickerEpisodesLoading(true);
  }, [id, adminKey]);

  useEffect(() => {
    const routeMal = malIdFromAnimeCatalogRouteId(id);
    if (routeMal == null) return;
    const primary = primaryMalForSplitCourMal(routeMal);
    if (primary === routeMal) return;
    const partEp = parseInt(searchParams.get("episode") ?? "1", 10);
    const { episode: mergedEp } = normalizeSplitCourMalEpisode(
      routeMal,
      Number.isFinite(partEp) && partEp >= 1 ? partEp : 1
    );
    router.replace(`/shows/anime_${primary}?episode=${mergedEp}`);
  }, [id, router, searchParams]);

  useEffect(() => {
    if (!show) return;
    const animeFilm =
      Boolean(show.is_anime) &&
      (show.anilist?.format === "MOVIE" || show.anilist?.format === "MUSIC");
    if (animeFilm) setPickerEpisodesLoading(false);
  }, [show]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!show || loading) return;
    if (progressAppliedForIdRef.current === id) return;

    const saved = loadWatchProgress(String(id));
    const urlEpRaw = searchParams.get("episode");
    const urlSeasonRaw = searchParams.get("season");
    const urlEp = urlEpRaw != null ? parseInt(urlEpRaw, 10) : NaN;
    const urlSeason = urlSeasonRaw != null ? parseInt(urlSeasonRaw, 10) : NaN;
    const cap = catalogAnimeEpisodeCount(show, id);

    if (Number.isFinite(urlEp) && urlEp >= 1) {
      const ep = cap != null ? Math.min(urlEp, cap) : urlEp;
      setSelectedSeason(Number.isFinite(urlSeason) && urlSeason >= 1 ? urlSeason : 1);
      setSelectedEpisode(ep);
    } else if (saved) {
      const list = tmdbSeasonsWithEpisodes(show.seasons);
      const seasonObj = list.find((s) => s.season_number === saved.lastSeason);
      const max = seasonObj?.episode_count ?? 0;
      if (max > 0 && saved.lastEpisode >= 1 && saved.lastEpisode <= max) {
        setSelectedSeason(saved.lastSeason);
        setSelectedEpisode(saved.lastEpisode);
      }
      setWatchedEpisodes(new Set(saved.watched));
    } else {
      setWatchedEpisodes(new Set());
    }
    progressAppliedForIdRef.current = id;
    setProgressHydrated(true);
  }, [id, show, loading, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!show || loading || !progressHydrated) return;
    saveWatchProgress(String(id), {
      lastSeason: selectedSeason,
      lastEpisode: selectedEpisode,
      watched: Array.from(watchedEpisodes),
    });
  }, [
    id,
    show,
    loading,
    progressHydrated,
    selectedSeason,
    selectedEpisode,
    watchedEpisodes,
  ]);

  useEffect(() => {
    const fetchShowDetails = async () => {
      try {
        setLoading(true);
        setShow(null);
        setShowUnavailableReason(null);
        setAdminBypassActive(false);
        setResolvedPlayerId(id);

        let targetTmdbId = id;
        let fallbackShow: Show | null = null;
        let bypassPolicy = false;

        const resolveQs = new URLSearchParams({ id });
        if (adminKey?.trim()) resolveQs.set("adminKey", adminKey.trim());
        const resolveRes = await fetch(`/api/tv/resolve?${resolveQs.toString()}`);
        if (!resolveRes.ok) {
          try {
            const err = (await resolveRes.json()) as {
              error?: string;
              message?: string;
            };
            if (err?.error === "unauthorized") {
              setShowUnavailableReason("unauthorized");
            } else if (err?.error === "content_policy" || err?.error === "not_found") {
              setShowUnavailableReason(err.error);
            } else {
              setShowUnavailableReason("not_found");
            }
          } catch {
            setShowUnavailableReason("not_found");
          }
          return;
        }

        const resolved = await resolveRes.json();
        if (resolved?.error) {
          if (resolved.error === "unauthorized") {
            setShowUnavailableReason("unauthorized");
          } else if (resolved.error === "content_policy" || resolved.error === "not_found") {
            setShowUnavailableReason(resolved.error);
          } else {
            setShowUnavailableReason("not_found");
          }
          return;
        }
        bypassPolicy = resolved?.adminBypass === true;
        if (bypassPolicy) setAdminBypassActive(true);
        const isAnimeCatalogRoute = /^anime_/i.test(String(id).trim());
        if (resolved?.playerId != null && !isAnimeCatalogRoute) {
          targetTmdbId = String(resolved.playerId);
          setResolvedPlayerId(String(resolved.playerId));
        }
        if (resolved?.fallback && typeof resolved.fallback === "object") {
          fallbackShow = resolved.fallback as Show;
        }

        const isNumericId = /^\d+$/.test(targetTmdbId);

        const pickFirstSeason = (seasons: Season[] | undefined) => {
          if (!seasons?.length) return;
          const first =
            seasons.find((s) => s.season_number === 1 && (s.episode_count ?? 0) > 0) ??
            seasons.find((s) => s.season_number >= 1 && (s.episode_count ?? 0) > 0) ??
            seasons[0];
          if (first) setSelectedSeason(first.season_number);
        };

        if (!/^\d+$/.test(targetTmdbId)) {
          if (!fallbackShow) {
            setShow(null);
            return;
          }
          const merged = await fetchAnilistAndMerge(fallbackShow, fallbackShow, id);
          const poster = animePosterFromDoc(merged);
          if (poster) merged.poster_path = poster;
          const backdrop = animeBackdropFromDoc(merged);
          if (backdrop) merged.backdrop_path = backdrop;
          if (
            merged.is_anime &&
            Array.isArray(fallbackShow.tmdb_playback_seasons) &&
            fallbackShow.tmdb_playback_seasons.length > 0
          ) {
            merged.tmdb_playback_seasons = fallbackShow.tmdb_playback_seasons;
          }
          const today = catalogTodayYmdUtc();
          if (merged.seasons?.length && !merged.is_anime) {
            merged.seasons = filterReleasedSeasons(merged.seasons, today) ?? merged.seasons;
          }
          const withTrailer = await attachAnimeTrailerVideos(merged);
          setShow(withTrailer);
          pickFirstSeason(withTrailer.seasons);
          setSelectedEpisode(1);
          return;
        }

        const url = `/api/tv/details?id=${encodeURIComponent(targetTmdbId)}`;
        const res = await fetch(url);
        if (!res.ok) {
          if (fallbackShow) {
            const merged = await fetchAnilistAndMerge(fallbackShow, fallbackShow, id);
            const poster = animePosterFromDoc(merged);
            if (poster) merged.poster_path = poster;
            const backdrop = animeBackdropFromDoc(merged);
            if (backdrop) merged.backdrop_path = backdrop;
            const today = catalogTodayYmdUtc();
            if (merged.seasons?.length && !merged.is_anime) {
              merged.seasons = filterReleasedSeasons(merged.seasons, today) ?? merged.seasons;
            }
            const withTrailer = await attachAnimeTrailerVideos(merged);
            setShow(withTrailer);
            pickFirstSeason(withTrailer.seasons);
            setSelectedEpisode(1);
            return;
          }
          throw new Error("Failed to fetch show details");
        }
        const data = (await res.json()) as Show;
        const catalogIdForPolicy =
          /^anime_/i.test(String(id).trim())
            ? String(id).trim()
            : typeof fallbackShow?.id === "string" && fallbackShow.id.startsWith("anime_")
              ? fallbackShow.id
              : Number(targetTmdbId) || targetTmdbId;
        const blockedDoc = {
          type: "tv" as const,
          id: catalogIdForPolicy,
          origin_country: data.origin_country,
          original_language: data.original_language,
          genres: data.genres,
          genre_ids: Array.isArray(data.genres)
            ? data.genres.map((g) => g?.id).filter((n) => typeof n === "number")
            : [],
          imdb_genres: fallbackShow?.imdb_genres,
          is_anime: fallbackShow?.is_anime,
          mal_id: fallbackShow?.mal_id,
        };
        if (shouldPruneTvAnimeWithoutAnilist(blockedDoc) && !bypassPolicy) {
          setShowUnavailableReason(showUnavailableReasonForDoc(blockedDoc));
          return;
        }
        if (fallbackShow?.is_anime) data.is_anime = true;
        const todayYmd = catalogTodayYmdUtc();
        if (!data.is_anime && Array.isArray(data.seasons) && data.seasons.length) {
          const rel = filterReleasedSeasons(data.seasons as Season[], todayYmd);
          if (rel?.length) data.seasons = rel as Show["seasons"];
        }
        if (fallbackShow?.is_anime) {
          const poster = animePosterFromDoc(fallbackShow);
          if (poster) data.poster_path = poster;
          const backdrop = animeBackdropFromDoc(fallbackShow);
          if (backdrop) data.backdrop_path = backdrop;
        } else {
          if (fallbackShow && !data?.poster_path && fallbackShow.poster_path) {
            data.poster_path = fallbackShow.poster_path;
          }
          if (fallbackShow && !data?.backdrop_path && fallbackShow.backdrop_path) {
            data.backdrop_path = fallbackShow.backdrop_path;
          }
        }
        const fallbackAniId = catalogAnilistId(fallbackShow);
        if (fallbackAniId != null && data.anilist_id == null) {
          data.anilist_id = fallbackAniId;
        }
        if (fallbackShow?.anilist) data.anilist = fallbackShow.anilist;
        if (fallbackShow?.mal_id != null) data.mal_id = fallbackShow.mal_id;
        if (fallbackShow?.external_ids) {
          data.external_ids = { ...fallbackShow.external_ids, ...data.external_ids };
        }
        if (fallbackShow?.imdb_genres?.length) {
          data.imdb_genres = fallbackShow.imdb_genres;
        }
        if (fallbackShow?.omdb) {
          data.omdb = fallbackShow.omdb;
        }

        const tmdbSeasonsPlayback =
          data.is_anime && Array.isArray(data.seasons)
            ? tmdbSeasonsWithEpisodes(data.seasons as Season[])
            : undefined;

        const forAni: Show = {
          ...data,
          anilist_id: data.anilist_id ?? catalogAnilistId(fallbackShow) ?? undefined,
          mal_id: data.mal_id ?? fallbackShow?.mal_id ?? undefined,
          external_ids: data.external_ids ?? fallbackShow?.external_ids ?? undefined,
        };
        const merged = await fetchAnilistAndMerge(forAni, fallbackShow, id);
        const poster = animePosterFromDoc(merged);
        if (poster) merged.poster_path = poster;
        const backdrop = animeBackdropFromDoc(merged);
        if (backdrop) merged.backdrop_path = backdrop;
        if (merged.seasons?.length && !merged.is_anime) {
          merged.seasons = filterReleasedSeasons(merged.seasons, todayYmd) ?? merged.seasons;
        }
        if (tmdbSeasonsPlayback?.length && data.is_anime) {
          merged.tmdb_playback_seasons = tmdbSeasonsPlayback;
        }
        const finalShow = await attachAnimeTrailerVideos(merged);
        setShow(finalShow);
        pickFirstSeason(finalShow.seasons);
        setSelectedEpisode(1);
      } catch {
        /* keep prior show on transient errors */
      } finally {
        setLoading(false);
      }
    };
    fetchShowDetails();
  }, [id, adminKey]);

  // Anime films (AniList format MOVIE/MUSIC) have no TMDB tv id; resolve a TMDB movie id so they
  // play through the standard movie embed instead of the legacy AniList /anime path.
  useEffect(() => {
    if (!show || loading) {
      return;
    }
    const isMovie =
      Boolean(show.is_anime) &&
      (show.anilist?.format === "MOVIE" || show.anilist?.format === "MUSIC");
    if (!isMovie) {
      setAnimeMovieTmdbId(null);
      setAnimeMovieResolving(false);
      return;
    }

    let cancelled = false;
    setAnimeMovieResolving(true);
    setAnimeMovieTmdbId(null);
    fetch(`/api/anime/resolve-movie?id=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        const mid =
          j && typeof j.movieId === "number" && j.movieId > 0 ? String(j.movieId) : null;
        setAnimeMovieTmdbId(mid);
      })
      .catch(() => {
        if (!cancelled) setAnimeMovieTmdbId(null);
      })
      .finally(() => {
        if (!cancelled) setAnimeMovieResolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [show, loading, id]);

  useEffect(() => {
    setFetchedBannerUrl(null);
    if (loading || !show || viewMode !== "details") return;
    if (!isAnimeShowPage(show, id)) return;

    const inlineBanner = String(show.anilist?.bannerImage ?? "").trim();
    if (inlineBanner) return;

    const aniId = catalogAnilistId(show);
    const malFromRoute = malIdFromAnimeCatalogRouteId(id);
    const malId = show.mal_id ?? malFromRoute;
    const qs =
      aniId != null
        ? `anilistId=${aniId}`
        : malId != null
          ? `idMal=${malId}`
          : null;
    if (!qs) return;

    let cancelled = false;
    fetch(`/api/anilist/media?${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data || typeof data !== "object") return;
        const banner =
          typeof data.bannerImage === "string" && data.bannerImage.trim()
            ? data.bannerImage.trim()
            : typeof data.coverImage?.extraLarge === "string"
              ? data.coverImage.extraLarge.trim()
              : typeof data.coverImage?.large === "string"
                ? data.coverImage.large.trim()
                : "";
        if (banner) setFetchedBannerUrl(tmdbImageUrl(banner) || banner);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [loading, show, id, viewMode]);

  useEffect(() => {
    const displayName = showDisplayTitle(show);
    if (!show || !displayName) return;
    const year = show.first_air_date?.slice(0, 4);
    if (viewMode === "details") {
      document.title = year
        ? `${displayName} (${year}) - Teavie`
        : `${displayName} - Teavie`;
      return;
    }
    const seasonEpisode = `S${selectedSeason}E${selectedEpisode}`;
    document.title = year
      ? `${displayName} (${year}) ${seasonEpisode} - Teavie`
      : `${displayName} ${seasonEpisode} - Teavie`;
  }, [show, selectedSeason, selectedEpisode, viewMode]);

  const releasedSeasonsForUi = show?.seasons?.filter((s) => s.season_number >= 1) ?? [];
  const resolvedIsNumeric = /^\d+$/.test(String(resolvedPlayerId));
  /** MAL id from `/shows/anime_{malId}` or doc — drives related rails / recommendations. */
  const idMalForAnilistRails = catalogMalIdForAnilistApi(show, id);
  const showAnimeRelated =
    !loading &&
    show != null &&
    Boolean(show.is_anime) &&
    idMalForAnilistRails != null;
  const playerUsesTmdb = resolvedIsNumeric;
  const aniListEpCap = anilistEpisodeCap(show);
  /** Anime film (AniList format MOVIE/MUSIC): single playback, no episode picker. */
  const isAnimeMovie =
    Boolean(show?.is_anime) &&
    (show?.anilist?.format === "MOVIE" || show?.anilist?.format === "MUSIC");
  /**
   * Anime uses AniList/catalog episode numbers in the picker; TMDB layout is kept only
   * in `tmdb_playback_seasons` for embed mapping inside the player.
   */
  const useFlatAllEpisodesPicker = false;
  const animeEpisodeCap = Boolean(show?.is_anime)
    ? (catalogAnimeEpisodeCount(show, id) ?? aniListEpCap ?? null)
    : null;
  const useTmdbSeasonAiringCapForPlayer =
    Boolean(show && playerUsesTmdb) && !Boolean(show?.is_anime);

  const tmdbShowPremiered = catalogTvPremiered(show);
  const malIdForPlayer = (() => {
    const fromRoute = malIdFromAnimeCatalogRouteId(id);
    if (fromRoute != null) return fromRoute;
    const raw = catalogMalIdForAnilistApi(show, id);
    if (raw == null) return null;
    return primaryMalForSplitCourMal(raw);
  })();
  const isAnimeCatalogRoute = /^anime_/i.test(String(id).trim());
  const animeAbsoluteEpisode = (() => {
    if (!show?.is_anime) return Math.max(1, selectedEpisode);
    const uiSeasons = tmdbSeasonsWithEpisodes(show.seasons);
    if (uiSeasons.length <= 1 && selectedSeason <= 1) {
      return Math.max(1, selectedEpisode);
    }
    return cumulativeTvEpisode(show.seasons, selectedSeason, selectedEpisode);
  })();
  const canPlayAnime =
    Boolean(show?.is_anime) &&
    !isAnimeMovie &&
    malIdForPlayer != null &&
    tmdbShowPremiered;
  const canPlayTv = !show?.is_anime && playerUsesTmdb && tmdbShowPremiered;
  const canPlay = canPlayAnime || canPlayTv;
  const imageUrl =
    show && (show.is_anime || isAnimeCatalogRoute)
      ? tmdbImageUrl(animePosterFromDoc({ ...show, id: show.id ?? id }))
      : tmdbImageUrl(show?.poster_path);
  const title = show ? showDisplayTitle(show) : "";
  const trailerEmbedUrl = show?.is_anime
    ? pickAnilistYoutubeTrailerEmbedUrl(show.anilist?.trailer) ??
      pickYoutubeTrailerEmbedUrl(show?.videos)
    : pickYoutubeTrailerEmbedUrl(show?.videos);
  const animeAccentColor = show?.anilist?.coverImage?.color ?? null;

  const partyRoomId = searchParams.get("party");
  const watchHref = buildShowWatchHref(id, {
    season: selectedSeason,
    episode: selectedEpisode,
    party: partyRoomId,
  });

  useEffect(() => {
    if (
      viewMode !== "details" ||
      !partyRoomId ||
      loading ||
      !show ||
      !progressHydrated
    ) {
      return;
    }
    router.replace(watchHref);
  }, [viewMode, partyRoomId, loading, show, progressHydrated, watchHref, router]);

  const applyGuestSync = useCallback((plan: GuestSyncPayload) => {
    setSelectedSeason(plan.season);
    setSelectedEpisode(plan.episode);
    setPlayerStartSeconds(plan.targetSeconds);
    if (plan.remount) setPlayerEpoch((n) => n + 1);
  }, []);

  const watchParty = useWatchParty({
    catalogId: id,
    mediaType: "tv",
    title,
    season: selectedSeason,
    episode: selectedEpisode,
    roomIdFromUrl: partyRoomId,
    onGuestSync: applyGuestSync,
  });

  useEffect(() => {
    if (!progressHydrated || watchParty.room) return;
    const sec = loadEpisodePlaybackPosition(String(id), selectedSeason, selectedEpisode);
    setPlayerStartSeconds(sec);
    setPlayerEpoch((n) => n + 1);
  }, [id, selectedSeason, selectedEpisode, progressHydrated, watchParty.room]);

  const markEpisodeWatched = useCallback((season: number, episode: number) => {
    const key = formatWatchEpKey(season, episode);
    setWatchedEpisodes((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const markEpisodeWatchedFromPlayback = useCallback(
    (season: number, episode: number, seconds: number) => {
      if (!Number.isFinite(seconds) || seconds < 1) return;
      markEpisodeWatched(season, episode);
    },
    [markEpisodeWatched]
  );

  const handleVideasyProgress = useCallback(
    (msg: VideasyProgressMessage) => {
      const s = msg.season ?? selectedSeason;
      const e = msg.episode ?? selectedEpisode;
      markEpisodeWatchedFromPlayback(s, e, msg.timestamp);
      saveEpisodePlaybackPosition(String(id), s, e, msg.timestamp);
      if (msg.timestamp >= WATCH_HISTORY_MIN_PLAY_SECONDS) {
        touchWatchHistory(String(id), {
          mediaType: "tv",
          lastSeason: s,
          lastEpisode: e,
        });
      }
      watchParty.noteHostPlayback(msg.timestamp);

      if (!watchParty.isHost || !watchParty.room || server !== "videasy") return;
      const now = Date.now();
      if (now - partyPlaybackBroadcastRef.current < PARTY_HOST_BROADCAST_MS) return;
      partyPlaybackBroadcastRef.current = now;
      void watchParty.broadcastPlayback(msg.timestamp);
    },
    [
      id,
      selectedSeason,
      selectedEpisode,
      server,
      watchParty.isHost,
      watchParty.room,
      watchParty.broadcastPlayback,
      markEpisodeWatchedFromPlayback,
    ]
  );

  const advanceAnimeEpisode = useCallback(() => {
    if (!show?.is_anime) return;
    if (watchParty.room && !watchParty.isHost) return;
    const cap = animeEpisodeCap ?? catalogAnimeEpisodeCount(show, id);
    const uiSeasons = tmdbSeasonsWithEpisodes(show.seasons);
    if (uiSeasons.length <= 1 && selectedSeason <= 1) {
      const next = selectedEpisode + 1;
      if (cap != null && next > cap) return;
      setSelectedEpisode(next);
      setPlayerStartSeconds(0);
      setPlayerEpoch((n) => n + 1);
      return;
    }
    const abs = cumulativeTvEpisode(show.seasons, selectedSeason, selectedEpisode);
    const nextAbs = abs + 1;
    if (cap != null && nextAbs > cap) return;
    const { season, episode } = tmdbSeasonEpisodeFromAbsolute(uiSeasons, nextAbs);
    setSelectedSeason(season);
    setSelectedEpisode(episode);
    setPlayerStartSeconds(0);
    setPlayerEpoch((n) => n + 1);
  }, [
    show,
    id,
    animeEpisodeCap,
    selectedSeason,
    selectedEpisode,
    watchParty.room,
    watchParty.isHost,
  ]);

  const handleMegaPlayMessage = useCallback(
    (msg: MegaPlayMessage) => {
      if (msg.kind === "complete") {
        markEpisodeWatched(selectedSeason, selectedEpisode);
        advanceAnimeEpisode();
        return;
      }
      if (msg.kind !== "progress") return;
      const sec = Math.floor(msg.currentTime);
      markEpisodeWatchedFromPlayback(selectedSeason, selectedEpisode, sec);
      saveEpisodePlaybackPosition(String(id), selectedSeason, selectedEpisode, sec);
      if (sec >= WATCH_HISTORY_MIN_PLAY_SECONDS) {
        touchWatchHistory(String(id), {
          mediaType: "tv",
          lastSeason: selectedSeason,
          lastEpisode: selectedEpisode,
        });
      }
      watchParty.noteHostPlayback(sec);
      if (!watchParty.isHost || !watchParty.room) return;
      const now = Date.now();
      if (now - partyPlaybackBroadcastRef.current < PARTY_HOST_BROADCAST_MS) return;
      partyPlaybackBroadcastRef.current = now;
      void watchParty.broadcastPlayback(sec);
    },
    [
      id,
      selectedSeason,
      selectedEpisode,
      watchParty.isHost,
      watchParty.room,
      watchParty.broadcastPlayback,
      advanceAnimeEpisode,
      markEpisodeWatched,
      markEpisodeWatchedFromPlayback,
    ]
  );

  useEffect(() => {
    if (!watchParty.isHost || !watchParty.room) {
      lastPartyEpRef.current = null;
      return;
    }
    const key = `${selectedSeason}:${selectedEpisode}`;
    if (lastPartyEpRef.current === key) return;
    lastPartyEpRef.current = key;
    void watchParty.broadcastEpisode(selectedSeason, selectedEpisode);
  }, [
    watchParty.isHost,
    watchParty.room?.roomId,
    selectedSeason,
    selectedEpisode,
    watchParty.broadcastEpisode,
  ]);

  const handleCreateParty = async (nickname: string) => {
    const roomId = await watchParty.createRoom(nickname);
    if (!roomId) return null;
    const params = new URLSearchParams(searchParams.toString());
    params.set("party", roomId);
    router.replace(`${pathname}?${params.toString()}`);
    return roomId;
  };

  const handleJoinParty = (code: string, nickname: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("party", code.trim().toUpperCase());
    router.replace(`${pathname}?${params.toString()}`);
    void watchParty.joinRoom(code.trim().toUpperCase(), nickname);
  };

  const handleLeaveParty = () => {
    watchParty.leaveRoom();
    const params = new URLSearchParams(searchParams.toString());
    params.delete("party");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  };

  const partyNavError =
    watchParty.room && watchParty.room.catalogId !== id
      ? "This party is for a different title — open the shared link from the host."
      : watchParty.error;

  const watchPartyNavRegistration = useMemo(
    () =>
      viewMode === "watch" && canPlay && !isAnimeMovie
        ? {
            canPlay: true,
            room: watchParty.room,
            isHost: watchParty.isHost,
            loading: watchParty.loading,
            error: partyNavError,
            nickname: watchParty.nickname,
            mediaType: "tv" as const,
            title,
            onCreate: handleCreateParty,
            onJoin: handleJoinParty,
            onLeave: handleLeaveParty,
            onSendChat: watchParty.sendChat,
            onUpdateSettings: watchParty.updateSettings,
            onReleaseSync: watchParty.releaseSyncCheckpoint,
            guestJoinSyncRole: watchParty.guestJoinSyncRole,
          }
        : null,
    [
      viewMode,
      canPlay,
      isAnimeMovie,
      watchParty.room,
      watchParty.isHost,
      watchParty.loading,
      partyNavError,
      watchParty.nickname,
      watchParty.sendChat,
      watchParty.updateSettings,
      watchParty.releaseSyncCheckpoint,
      watchParty.guestJoinSyncRole,
      title,
      handleCreateParty,
      handleJoinParty,
      handleLeaveParty,
    ]
  );

  useRegisterWatchPartyNav(watchPartyNavRegistration);

  const animeHideSeasonRow =
    Boolean(show?.is_anime) && releasedSeasonsForUi.length <= 1;
  const showSeasonPickerStrip =
    !animeHideSeasonRow && !useFlatAllEpisodesPicker && !Boolean(show?.is_anime);

  const playerCoords =
    show?.is_anime
      ? resolveAnimePlayerCoords(show, selectedSeason, selectedEpisode)
      : { season: selectedSeason, episode: selectedEpisode };

  useEffect(() => {
    if (!show?.is_anime || !show.seasons?.length) return;
    const cap = catalogAnimeEpisodeCount(show, id);
    if (cap == null || cap <= 0) return;
    if (selectedSeason === 1 && selectedEpisode <= cap) return;
    if (selectedSeason !== 1) setSelectedSeason(1);
    if (selectedEpisode > cap) setSelectedEpisode(cap);
  }, [show, selectedSeason, selectedEpisode]);

  const pickerSeasons = show?.seasons ?? [];

  const animePickerEpisodeCap =
    Boolean(show?.is_anime)
      ? (animeEpisodeCap ?? catalogAnimeEpisodeCount(show, id))
      : null;

  const episodePickerProps = {
    tmdbTvId: show?.is_anime ? null : playerUsesTmdb ? String(resolvedPlayerId) : null,
    seasons: pickerSeasons,
    selectedSeason,
    selectedEpisode,
    onSeasonChange: setSelectedSeason,
    onEpisodeChange: (season: number, episode: number) => {
      setSelectedSeason(season);
      setSelectedEpisode(episode);
    },
    showSeasonTabs: showSeasonPickerStrip,
    preferCatalogEpisodes: Boolean(show?.is_anime),
    malId: Boolean(show?.is_anime) ? idMalForAnilistRails : null,
    fallbackStillPath:
      show?.is_anime && show
        ? animeBackdropFromDoc(show) ?? show.poster_path ?? null
        : null,
    flatMode: false,
    catalogAbsoluteEpisodes: false,
    flatEpisodeCap: animePickerEpisodeCap,
    watchedKeys: watchedEpisodes,
    onEpisodesLoadingChange: setPickerEpisodesLoading,
    onPlayableEpisodeCountChange: setPickerPlayableCount,
    showAnimeAudio: Boolean(show?.is_anime) && canPlayAnime,
  };

  const showDetailsPanel = (
    <div className="w-full">
      {show && (
        <CatalogMediaPanel
            posterUrl={imageUrl}
            posterAlt={title}
            title={title}
            logoPath={titleLogoPath}
            rating={Number.isFinite(Number(show.vote_average)) ? Number(show.vote_average) : null}
            certification={usCertificationFromDoc(show)}
            status={show.status}
            overview={show.overview}
            tagline={show.tagline}
            mediaType="tv"
            genres={catalogGenresForDisplay({
              imdb_genres: show.imdb_genres,
              omdb: show.omdb,
              genres: show.genres,
            })}
            infoLines={buildExtendedShowInfoLines(show, isAnimeShowPage(show, id))}
            links={buildShowDetailLinks(show)}
            statPills={buildShowDetailStatPills(show, isAnimeShowPage(show, id))}
            alternateTitles={buildShowAlternateTitles(show)}
            genreBrowseBase={isKdramaShow(show) ? "/kdrama/all" : undefined}
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <FavoriteButton catalogId={String(id)} mediaType="tv" iconOnly />
                <WatchLaterButton catalogId={String(id)} mediaType="tv" iconOnly />
                {viewMode === "details" && (canPlay || isAnimeMovie) ? (
                  <Button
                    as={Link}
                    href={watchHref}
                    color="success"
                    size="sm"
                    radius="md"
                    className="h-8 min-h-8 px-3 text-sm font-medium"
                  >
                    Watch
                  </Button>
                ) : null}
              </div>
            }
            creditsSection={
              viewMode === "details" && !isAnimeMovie ? (
                <MovieCreditsStrip
                  variant="show"
                  credits={show.aggregate_credits}
                />
              ) : null
            }
          />
      )}
    </div>
  );

  const showRelatedSections = (
    <>
      {showAnimeRelated && idMalForAnilistRails != null ? (
        <AnimeShowRails idMal={idMalForAnilistRails} bleed={false} />
      ) : null}

      {!Boolean(show?.is_anime) && /^\d+$/.test(String(resolvedPlayerId)) ? (
        <YouMightLike
          key={`yml-${resolvedPlayerId}`}
          mediaType="tv"
          id={resolvedPlayerId}
          bleed={false}
        />
      ) : null}
    </>
  );

  if (loading) {
    return viewMode === "details" ? (
      <CatalogDetailsSkeleton />
    ) : (
      <WatchPageSkeleton withSeasonPicker />
    );
  }

  if (!show) {
    return (
      <CatalogUnavailable
        reason={
          showUnavailableReason === "content_policy"
            ? "content_policy"
            : showUnavailableReason === "unauthorized"
              ? "unauthorized"
              : "not_found"
        }
      />
    );
  }

  const playerBlock = (
    <div
      id={SHOW_VIDEO_PLAYER_ID}
      className="aspect-video w-full max-h-[52vh] min-h-[200px] shrink-0 overflow-hidden rounded-xl bg-default-200 sm:max-h-[70vh] lg:aspect-auto lg:h-[min(80vh,900px)] lg:max-h-[80vh]"
    >
      {isAnimeMovie ? (
        animeMovieResolving ? (
          <PlayerEmbedSkeleton rounded="rounded-xl" />
        ) : animeMovieTmdbId ? (
          <MoviePlayer
            key={`movie-${id}`}
            videoId={animeMovieTmdbId}
            server={server}
            onVideasyProgress={
              server === "videasy"
                ? (msg) => {
                    const sec = Math.floor(Number(msg.timestamp) || 0);
                    if (sec < WATCH_HISTORY_MIN_PLAY_SECONDS) return;
                    saveMoviePlaybackPosition(String(id), sec);
                    recordMovieInWatchHistory(String(id));
                  }
                : undefined
            }
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-black/80 px-6 text-center text-sm text-white/70">
            No playback source available for this page yet. Try again later.
          </div>
        )
      ) : !canPlay ? (
        show && !tmdbShowPremiered ? (
          trailerEmbedUrl ? (
            <MovieTrailerEmbed src={trailerEmbedUrl} title={`${title} trailer`} />
          ) : (
            <CatalogComingSoon
              title={title}
              posterUrl={imageUrl}
              releaseDate={animeReleaseDateYmdFromDoc(show) ?? show.first_air_date}
              links={buildShowDetailLinks(show)}
            />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-black/80 px-6 text-center text-sm text-white/70">
            No playback source available for this page yet. Try again later.
          </div>
        )
      ) : useTmdbSeasonAiringCapForPlayer && pickerEpisodesLoading ? (
        <PlayerEmbedSkeleton />
      ) : useTmdbSeasonAiringCapForPlayer && pickerPlayableCount < 1 ? (
        <div className="flex h-full w-full items-center justify-center bg-black/80 px-6 text-center text-sm text-white/70">
          No released episodes to play in this season yet.
        </div>
      ) : (canPlayAnime || isAnimeCatalogRoute) && malIdForPlayer != null ? (
        <AnimePlayer
          key={`${malIdForPlayer}-${animeAbsoluteEpisode}-${animeAudio}-${playerEpoch}`}
          malId={malIdForPlayer}
          episode={animeAbsoluteEpisode}
          audio={animeAudio}
          startSeconds={playerStartSeconds}
          onMegaPlayMessage={handleMegaPlayMessage}
        />
      ) : (
        <ShowPlayer
          key={`${id}-${playerCoords.season}-${playerCoords.episode}-${playerEpoch}`}
          server={server}
          videoId={resolvedPlayerId}
          season={playerCoords.season}
          episode={playerCoords.episode}
          startSeconds={server === "videasy" ? playerStartSeconds : 0}
          onVideasyProgress={server === "videasy" ? handleVideasyProgress : undefined}
          onEmbedLoad={
            server === "vidcore"
              ? () =>
                  markEpisodeWatched(playerCoords.season, playerCoords.episode)
              : undefined
          }
        />
      )}
    </div>
  );

  if (viewMode === "details") {
    const isAnimeDetails = isAnimeShowPage(show, id);
    const detailsBannerUrl = resolveShowDetailsBannerUrl(
      show,
      id,
      imageUrl,
      fetchedBannerUrl
    );
    const hasDetailsHero = Boolean(detailsBannerUrl);
    const heroAccentColor = isAnimeDetails ? animeAccentColor : null;

    return (
      <div className="flex w-full flex-col overflow-x-hidden bg-background pb-32">
        {adminPreview && adminBypassActive ? (
          <div
            className={`mb-3 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-center text-xs text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200 ${SHOW_CONTENT_INSET_X}`}
          >
            Admin preview — content policy bypass active
          </div>
        ) : null}
        {hasDetailsHero ? (
          <ShowDetailsHero
            bannerUrl={detailsBannerUrl!}
            accentColor={heroAccentColor}
            title={title}
          />
        ) : null}
        <div
          className={`relative z-10 flex w-full flex-col gap-6 ${SHOW_CONTENT_INSET_X} ${
            hasDetailsHero
              ? SHOW_DETAILS_HERO_OVERLAP
              : "bg-background/92 dark:bg-background/88"
          }`}
        >
          {showDetailsPanel}
          {trailerEmbedUrl && (canPlay || !tmdbShowPremiered) ? (
            <MovieTrailerEmbed
              variant="details"
              src={trailerEmbedUrl}
              title={`${title} trailer`}
            />
          ) : null}
          {showRelatedSections}
        </div>
      </div>
    );
  }

  const watchMainContent = (
    <>
      {playerBlock}
      <ShowWatchPlayerHeading title={title} />
      {!isAnimeMovie ? (
        <div className="flex w-full flex-col gap-2">
          <ShowEpisodePickerControls />
          <ShowEpisodePickerList />
        </div>
      ) : null}
    </>
  );

  return (
    <div className="flex min-h-full w-full flex-col bg-background/92 px-0 pt-0 pb-32 dark:bg-background/88">
      {adminPreview && adminBypassActive ? (
        <div className="mb-3 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-center text-xs text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200">
          Admin preview — content policy bypass active
        </div>
      ) : null}
      <div className={`flex w-full flex-col gap-6 ${SHOW_CONTENT_INSET_X}`}>
        {!isAnimeMovie ? (
          <ShowEpisodePickerProvider {...episodePickerProps}>
            {watchMainContent}
          </ShowEpisodePickerProvider>
        ) : (
          watchMainContent
        )}
      </div>
    </div>
  );
}

