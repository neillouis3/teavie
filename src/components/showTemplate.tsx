'use client';

import React, { useState, useEffect, useRef } from "react";
import ShowPlayer from "./showPlayer";
import AnimePlayer from "./animePlayer";
import MoviePlayer from "./moviePlayer";
import YouMightLike from "./youMightLike";
import AnimeRelatedSection from "./animeRelatedSection";
import {
  cumulativeTvEpisode,
  tmdbSeasonEpisodeFromAbsolute,
} from "@/lib/cumulativeTvEpisode";
import ShowEpisodePicker, {
  ShowEpisodePickerControls,
  ShowEpisodePickerList,
  ShowEpisodePickerProvider,
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
} from "@/lib/watchProgress";
import { touchWatchHistory } from "@/lib/watchHistory";
import {
  buildShowInfoLines,
  catalogGenresForDisplay,
  type CatalogDetailLink,
} from "@/components/ui/catalogDetailColumns";
import CatalogMediaPanel, {
  CatalogMediaPanelSkeleton,
  showSubtitleLine,
} from "@/components/ui/catalogMediaPanel";
import CatalogComingSoon from "@/components/ui/catalogComingSoon";
import CatalogUnavailable from "@/components/ui/catalogUnavailable";
import { usCertificationFromDoc } from "@/lib/mapContentDocToItem";
import { imdbGenresFromAnimeSources } from "@/lib/imdbGenres";
import { tmdbImageUrl } from "@/lib/tmdbImage";
import {
  shouldPruneTvAnimeWithoutAnilist,
  showUnavailableReasonForDoc,
} from "@/lib/tvJpAnimePrune";

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
    format?: string | null;
    /** AniList total episode count (finished/airing cap); drives picker cap with TMDB season map. */
    episodes?: number | null;
  } | null;
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

/** AniList-reported total episodes (null while unknown / airing). */
function anilistEpisodeCap(show: Show | null | undefined): number | null {
  const e = show?.anilist?.episodes;
  if (typeof e !== "number" || !Number.isFinite(e) || e <= 0) return null;
  return e;
}

/** Catalog / AniList / IMDb-adjacent episode total for anime UI + picker. */
function catalogAnimeEpisodeCount(show: Show | null | undefined): number | null {
  const fromAni = anilistEpisodeCap(show);
  if (fromAni != null) return fromAni;
  const fromDoc = show?.number_of_episodes;
  if (typeof fromDoc === "number" && Number.isFinite(fromDoc) && fromDoc > 0) {
    return fromDoc;
  }
  return null;
}

function applyAnimeCatalogEpisodeLayout(show: Show): Show {
  if (!show.is_anime) return show;
  const eps = catalogAnimeEpisodeCount(show);
  if (eps == null || eps <= 0) return show;
  return {
    ...show,
    seasons: [{ season_number: 1, episode_count: eps }],
    number_of_seasons: 1,
    number_of_episodes: eps,
  };
}

/** Prefer AniList/catalog episodes for anime UI; fall back to flattened TMDB totals. */
function finalizeAnimeShowForUi(show: Show): Show {
  if (!show.is_anime) return show;
  const withCatalog = applyAnimeCatalogEpisodeLayout(show);
  if (catalogAnimeEpisodeCount(show) != null) return withCatalog;
  return withAnimeFlatEpisodeLayout(withCatalog);
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
};

function tmdbSeasonsWithEpisodes(seasons: Season[] | undefined): Season[] {
  return (seasons ?? []).filter(
    (s) => s.season_number >= 1 && typeof s.episode_count === "number" && s.episode_count > 0
  );
}

function showDetailLinks(show: Show): CatalogDetailLink[] {
  const links: CatalogDetailLink[] = [];
  const imdbId = show.external_ids?.imdb_id;
  if (imdbId && /^tt\d+/i.test(String(imdbId))) {
    links.push({
      href: `https://www.imdb.com/title/${imdbId}/`,
      label: "IMDb",
    });
  }
  const homepage = String(show.homepage ?? "").trim();
  if (homepage) {
    links.push({ href: homepage, label: "Official site" });
  }
  const anilistUrl = String(show.anilist?.siteUrl ?? "").trim();
  if (anilistUrl) {
    links.push({ href: anilistUrl, label: "AniList" });
  }
  return links;
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
  };

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
  else return base.is_anime ? finalizeAnimeShowForUi(base) : base;

  try {
    const res = await fetch(url);
    if (!res.ok) return base.is_anime ? finalizeAnimeShowForUi(base) : base;
    const ani = (await res.json()) as AnilistMediaPayload & { error?: string };
    if (!ani || typeof ani !== "object" || "error" in ani) {
      return base.is_anime ? finalizeAnimeShowForUi(base) : base;
    }
    if (typeof ani.id !== "number") {
      return base.is_anime ? finalizeAnimeShowForUi(base) : base;
    }
    const merged = mergeAnilistIntoShow(base, ani, fallback);
    return base.is_anime || merged.is_anime ? finalizeAnimeShowForUi(merged) : merged;
  } catch {
    return base.is_anime ? finalizeAnimeShowForUi(base) : base;
  }
}

export type ShowServerKey = StreamServerId;

export default function ShowTemplate({
  id,
  adminKey,
  adminPreview = false,
}: {
  id: string;
  adminKey?: string;
  adminPreview?: boolean;
}) {
  const { server } = useStreamingSource();
  const { audio: animeAudio } = useAnimeAudio();
  const [show, setShow] = useState<Show | null>(null);
  const [resolvedPlayerId, setResolvedPlayerId] = useState<string>(id);
  const [loading, setLoading] = useState(true);
  /** TMDB movie id for anime films (AniList format MOVIE/MUSIC), resolved via /api/anime/resolve-movie. */
  const [animeMovieTmdbId, setAnimeMovieTmdbId] = useState<string | null>(null);
  const [animeMovieResolving, setAnimeMovieResolving] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [pickerEpisodesLoading, setPickerEpisodesLoading] = useState(false);
  const [pickerPlayableCount, setPickerPlayableCount] = useState(0);
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(
    () => new Set()
  );
  const [progressHydrated, setProgressHydrated] = useState(false);
  const [showUnavailableReason, setShowUnavailableReason] = useState<
    "content_policy" | "not_found" | "unauthorized" | null
  >(null);
  const [adminBypassActive, setAdminBypassActive] = useState(false);
  const progressAppliedForIdRef = useRef<string | null>(null);

  useEffect(() => {
    progressAppliedForIdRef.current = null;
    setProgressHydrated(false);
    setShowUnavailableReason(null);
    setAdminBypassActive(false);
  }, [id, adminKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!show || loading) return;
    if (progressAppliedForIdRef.current === id) return;

    const saved = loadWatchProgress(String(id));
    if (saved) {
      const list = tmdbSeasonsWithEpisodes(show.seasons);
      const seasonObj = list.find((s) => s.season_number === saved.lastSeason);
      const max = seasonObj?.episode_count ?? 0;
      if (max > 0 && saved.lastEpisode >= 1 && saved.lastEpisode <= max) {
        setSelectedSeason(saved.lastSeason);
        setSelectedEpisode(saved.lastEpisode);
      }
      setWatchedEpisodes(new Set(saved.watched));
    } else {
      const list = tmdbSeasonsWithEpisodes(show.seasons);
      const firstSeason =
        list.find((s) => s.season_number >= 1 && (s.episode_count ?? 0) > 0) ??
        list[0];
      const seasonNum = firstSeason?.season_number ?? 1;
      setWatchedEpisodes(new Set([formatWatchEpKey(seasonNum, 1)]));
    }
    progressAppliedForIdRef.current = id;
    setProgressHydrated(true);
  }, [id, show, loading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!show || loading || !progressHydrated) return;
    saveWatchProgress(String(id), {
      lastSeason: selectedSeason,
      lastEpisode: selectedEpisode,
      watched: Array.from(watchedEpisodes),
    });
    touchWatchHistory(String(id), {
      mediaType: "tv",
      lastSeason: selectedSeason,
      lastEpisode: selectedEpisode,
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
        if (resolved?.playerId != null) {
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
          const today = catalogTodayYmdUtc();
          if (merged.seasons?.length && !merged.is_anime) {
            merged.seasons = filterReleasedSeasons(merged.seasons, today) ?? merged.seasons;
          }
          setShow(merged);
          pickFirstSeason(merged.seasons);
          setSelectedEpisode(1);
          return;
        }

        const url = `https://api.themoviedb.org/3/tv/${targetTmdbId}?language=en-US&append_to_response=content_ratings`;
        const options = {
          method: "GET",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_TMDB_BEARER}`,
          },
        };
        const res = await fetch(url, options);
        if (!res.ok) {
          if (fallbackShow) {
            const merged = await fetchAnilistAndMerge(fallbackShow, fallbackShow, id);
            const today = catalogTodayYmdUtc();
            if (merged.seasons?.length && !merged.is_anime) {
              merged.seasons = filterReleasedSeasons(merged.seasons, today) ?? merged.seasons;
            }
            setShow(merged);
            pickFirstSeason(merged.seasons);
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
        if (fallbackShow && !data?.poster_path && fallbackShow.poster_path) {
          data.poster_path = fallbackShow.poster_path;
        }
        if (fallbackShow && !data?.backdrop_path && fallbackShow.backdrop_path) {
          data.backdrop_path = fallbackShow.backdrop_path;
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
        if (merged.seasons?.length && !merged.is_anime) {
          merged.seasons = filterReleasedSeasons(merged.seasons, todayYmd) ?? merged.seasons;
        }
        if (tmdbSeasonsPlayback?.length && data.is_anime) {
          merged.tmdb_playback_seasons = tmdbSeasonsPlayback;
        }
        setShow(merged);
        pickFirstSeason(merged.seasons);
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
    const displayName = showDisplayTitle(show);
    if (!show || !displayName) return;
    const year = show.first_air_date?.slice(0, 4);
    const seasonEpisode = `S${selectedSeason}E${selectedEpisode}`;
    document.title = year
      ? `${displayName} (${year}) ${seasonEpisode} - Teavie`
      : `${displayName} ${seasonEpisode} - Teavie`;
  }, [show, selectedSeason, selectedEpisode]);

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
  const animeEpisodeCap =
    Boolean(show?.is_anime) && aniListEpCap != null ? aniListEpCap : null;
  const useTmdbSeasonAiringCapForPlayer =
    Boolean(show && playerUsesTmdb) && !Boolean(show?.is_anime);

  const tmdbShowPremiered =
    !show ||
    !show.first_air_date ||
    String(show.first_air_date).trim().length < 10 ||
    String(show.first_air_date).slice(0, 10) <= catalogTodayYmdUtc();
  const anilistIdForPlayer = catalogAnilistId(show);
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
    anilistIdForPlayer != null &&
    tmdbShowPremiered;
  const canPlayTv = !show?.is_anime && playerUsesTmdb && tmdbShowPremiered;
  const canPlay = canPlayAnime || canPlayTv;
  const imageUrl = tmdbImageUrl(show?.poster_path);
  const title = show ? showDisplayTitle(show) : "";

  const animeHideSeasonRow =
    Boolean(show?.is_anime) && releasedSeasonsForUi.length <= 1;
  const showSeasonPickerStrip =
    !animeHideSeasonRow && !useFlatAllEpisodesPicker && !Boolean(show?.is_anime);

  const playerCoords =
    show?.is_anime
      ? resolveAnimePlayerCoords(show, selectedSeason, selectedEpisode)
      : { season: selectedSeason, episode: selectedEpisode };

  const markEpisodeWatched = (season: number, episode: number) => {
    setWatchedEpisodes((prev) => {
      const next = new Set(prev);
      next.add(formatWatchEpKey(season, episode));
      return next;
    });
  };

  useEffect(() => {
    if (!show?.is_anime || !show.seasons?.length) return;
    const cap = catalogAnimeEpisodeCount(show);
    if (cap == null || cap <= 0) return;
    if (selectedSeason === 1 && selectedEpisode <= cap) return;
    if (selectedSeason !== 1) setSelectedSeason(1);
    if (selectedEpisode > cap) setSelectedEpisode(cap);
  }, [show, selectedSeason, selectedEpisode]);

  const showDetailsPanel = (
    <div className="w-full">
      {loading ? (
        <CatalogMediaPanelSkeleton />
      ) : (
        show && (
          <CatalogMediaPanel
            posterUrl={imageUrl}
            posterAlt={title}
            title={title}
            subtitleLine={showSubtitleLine(show)}
            rating={Number.isFinite(Number(show.vote_average)) ? Number(show.vote_average) : null}
            certification={usCertificationFromDoc(show)}
            status={show.status}
            overview={show.overview}
            tagline={show.tagline}
            mediaType="tv"
            genres={catalogGenresForDisplay({
              imdb_genres: show.imdb_genres,
              omdb: show.omdb,
            })}
            infoLines={buildShowInfoLines(show)}
            links={showDetailLinks(show)}
            genreBrowseBase={isKdramaShow(show) ? "/kdrama/all" : undefined}
          />
        )
      )}
    </div>
  );

  const showRelatedSections = (
    <>
      {!loading && showAnimeRelated ? (
        <AnimeRelatedSection key={`related-${idMalForAnilistRails ?? "na"}`} idMal={idMalForAnilistRails ?? undefined} />
      ) : null}

      {!loading &&
      ((Boolean(show?.is_anime) && idMalForAnilistRails != null) ||
        (!Boolean(show?.is_anime) && /^\d+$/.test(String(resolvedPlayerId)))) ? (
        <YouMightLike
          key={`yml-${resolvedPlayerId}-${idMalForAnilistRails ?? "na"}`}
          mediaType="tv"
          id={resolvedPlayerId}
          isAnime={Boolean(show?.is_anime)}
          idMal={idMalForAnilistRails ?? undefined}
        />
      ) : null}
    </>
  );

  const animeUseTmdbEpisodes = Boolean(show?.is_anime) && playerUsesTmdb;
  const pickerSeasons =
    animeUseTmdbEpisodes && show?.tmdb_playback_seasons?.length
      ? show.tmdb_playback_seasons
      : show?.seasons ?? [];

  const episodePickerProps = {
    tmdbTvId: playerUsesTmdb ? String(resolvedPlayerId) : null,
    seasons: pickerSeasons,
    selectedSeason,
    selectedEpisode,
    onSeasonChange: setSelectedSeason,
    onEpisodeChange: (season: number, episode: number) => {
      setSelectedSeason(season);
      setSelectedEpisode(episode);
    },
    showSeasonTabs: showSeasonPickerStrip,
    preferCatalogEpisodes: Boolean(show?.is_anime) && !playerUsesTmdb,
    malId: Boolean(show?.is_anime) && !playerUsesTmdb ? idMalForAnilistRails : null,
    fallbackStillPath:
      show?.is_anime ? show.backdrop_path ?? show.poster_path ?? null : null,
    flatMode:
      animeUseTmdbEpisodes && Boolean(show?.tmdb_playback_seasons?.length),
    catalogAbsoluteEpisodes: animeUseTmdbEpisodes,
    flatEpisodeCap: animeEpisodeCap,
    watchedKeys: watchedEpisodes,
    onMarkWatched: markEpisodeWatched,
    onEpisodesLoadingChange: setPickerEpisodesLoading,
    onPlayableEpisodeCountChange: setPickerPlayableCount,
    showAnimeAudio: Boolean(show?.is_anime) && canPlayAnime,
  };

  if (!loading && !show) {
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

  return (
    <div className="flex min-h-full w-full flex-col bg-background/92 px-0 py-4 pb-32 dark:bg-background/88">
      {adminPreview && adminBypassActive ? (
        <div className="mb-3 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-center text-xs text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200">
          Admin preview — content policy bypass active
        </div>
      ) : null}
      <div className="w-full flex flex-col gap-6">

        {/* ── Video Player (horizontal inset matches root py-4 / px-4) ── */}
        <div
          id={SHOW_VIDEO_PLAYER_ID}
          className="aspect-video w-full max-h-[52vh] min-h-[200px] shrink-0 overflow-hidden rounded-xl bg-default-200 sm:max-h-[70vh] lg:aspect-auto lg:h-[min(80vh,900px)] lg:max-h-[80vh]"
        >
          {loading ? (
            <div className="h-full w-full animate-pulse bg-default-200" />
          ) : isAnimeMovie ? (
            animeMovieResolving ? (
              <div className="flex h-full w-full items-center justify-center bg-black/80 px-6 text-center text-sm text-white/70">
                Loading player…
              </div>
            ) : animeMovieTmdbId ? (
              <MoviePlayer key={`movie-${id}`} videoId={animeMovieTmdbId} server={server} />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-black/80 px-6 text-center text-sm text-white/70">
                No playback source available for this page yet. Try again later.
              </div>
            )
          ) : !canPlay ? (
            playerUsesTmdb && show && !tmdbShowPremiered ? (
              <CatalogComingSoon
                title={title}
                posterUrl={imageUrl}
                releaseDate={show.first_air_date}
                links={showDetailLinks(show)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-black/80 px-6 text-center text-sm text-white/70">
                No playback source available for this page yet. Try again later.
              </div>
            )
          ) : useTmdbSeasonAiringCapForPlayer && pickerEpisodesLoading ? (
            <div className="flex h-full w-full items-center justify-center bg-black/80 px-6 text-center text-sm text-white/70">
              Loading aired episodes…
            </div>
          ) : useTmdbSeasonAiringCapForPlayer && pickerPlayableCount < 1 ? (
            <div className="flex h-full w-full items-center justify-center bg-black/80 px-6 text-center text-sm text-white/70">
              No released episodes to play in this season yet.
            </div>
          ) : canPlayAnime && anilistIdForPlayer != null ? (
            <AnimePlayer
              key={`${anilistIdForPlayer}-${animeAbsoluteEpisode}-${animeAudio}`}
              anilistId={anilistIdForPlayer}
              episode={animeAbsoluteEpisode}
              audio={animeAudio}
            />
          ) : (
            <ShowPlayer
              key={id}
              server={server}
              videoId={resolvedPlayerId}
              season={playerCoords.season}
              episode={playerCoords.episode}
            />
          )}
        </div>

        {!loading && show && !isAnimeMovie ? (
          <ShowEpisodePickerProvider {...episodePickerProps}>
            <div className="flex w-full flex-col gap-6">
              <div className="order-1 lg:order-2">{showDetailsPanel}</div>
              <div className="order-2 lg:order-1">
                <ShowEpisodePickerControls />
              </div>
              <div className="order-3 flex flex-col gap-6">
                <ShowEpisodePickerList />
                {showRelatedSections}
              </div>
            </div>
          </ShowEpisodePickerProvider>
        ) : (
          <>
            {showDetailsPanel}
            {showRelatedSections}
          </>
        )}
      </div>
    </div>
  );
}

