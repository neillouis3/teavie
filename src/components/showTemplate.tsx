'use client';

import React, { useState, useEffect, useRef } from "react";
import ShowPlayer from "./showPlayer";
import MoviePlayer from "./moviePlayer";
import YouMightLike from "./youMightLike";
import AnimeRelatedSection from "./animeRelatedSection";
import {
  cumulativeTvEpisode,
  tmdbSeasonEpisodeFromAbsolute,
} from "@/lib/cumulativeTvEpisode";
import { Button } from "@heroui/react";
import {
  useStreamingSource,
  type StreamServerId,
} from "@/contexts/streamingSourceContext";
import {
  formatWatchEpKey,
  loadWatchProgress,
  saveWatchProgress,
} from "@/lib/watchProgress";
import {
  buildShowInfoLines,
  type CatalogDetailLink,
} from "@/components/ui/catalogDetailColumns";
import CatalogMediaPanel, {
  CatalogMediaPanelSkeleton,
  showSubtitleLine,
} from "@/components/ui/catalogMediaPanel";
import { usCertificationFromDoc } from "@/lib/mapContentDocToItem";

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

/** AniList media id stored on catalog docs (root or nested). */
function catalogAnilistId(
  doc: Pick<Show, "anilist_id" | "anilist"> | null | undefined
): number | null {
  if (!doc) return null;
  if (typeof doc.anilist_id === "number" && doc.anilist_id > 0) return doc.anilist_id;
  if (typeof doc.anilist?.id === "number" && doc.anilist.id > 0) return doc.anilist.id;
  return null;
}

/**
 * Catalog anime pages use `/shows/anime_{malId}` (see `import-anime-to-tv.js`) — that number is MAL id,
 * not AniList id. Use it when `anilist_id` is missing on the merged show.
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

/** AniList-reported total episodes (null while unknown / airing). Used to cap flat TMDB-mapped grids vs embeds. */
function anilistEpisodeCap(show: Show | null | undefined): number | null {
  const e = show?.anilist?.episodes;
  if (typeof e !== "number" || !Number.isFinite(e) || e <= 0) return null;
  return e;
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

/** Sum of `episode_count` for TMDB seasons strictly before `seasonNum` (for continuous ep labels). */
function episodeOffsetBeforeSeason(seasons: Season[] | undefined, seasonNum: number): number {
  const list = tmdbSeasonsWithEpisodes(seasons).sort((a, b) => a.season_number - b.season_number);
  return list
    .filter((s) => s.season_number < seasonNum)
    .reduce((acc, s) => acc + (typeof s.episode_count === "number" ? s.episode_count : 0), 0);
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

/** If AniList merge did not run, still avoid TMDB multi-season UI for anime (flat absolute episode list). */
function withAnimeFlatEpisodeLayout(show: Show): Show {
  if (!show.is_anime) return show;
  if (Array.isArray(show.tmdb_playback_seasons) && show.tmdb_playback_seasons.length > 0) {
    return show;
  }
  const g = tmdbSeasonsWithEpisodes(show.seasons);
  if (g.length === 0) return show;
  const total = g.reduce(
    (acc, s) => acc + (typeof s.episode_count === "number" ? s.episode_count : 0),
    0
  );
  if (total <= 0) return show;
  if (g.length === 1 && g[0].season_number === 1 && (g[0].episode_count ?? 0) === total) {
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
  if (Array.isArray(ani.genres) && ani.genres.length && (!next.genres?.length)) {
    next.genres = ani.genres.map((name, i) => ({ id: 9000 + i, name }));
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

  // Live-action TV: keep TMDB season/episode structure. Anime without TMDB playback snapshot: AniList (or flat counts) only.
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

  // Anime: never replace TMDB season/episode layout with a single synthetic S1 when TMDB already
  // has episode counts (AniList `episodes` is only for embed/grid cap via `anilist.episodes`).
  if (next.is_anime && goodTmdb.length > 0) {
    next.seasons = goodTmdb.map((s) => ({ ...s }));
    next.number_of_seasons = goodTmdb.length;
    next.number_of_episodes = goodTmdb.reduce(
      (acc, s) => acc + (typeof s.episode_count === "number" ? s.episode_count : 0),
      0
    );
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
  fallback: Show | null
): Promise<Show> {
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
    typeof base.mal_id === "number" && base.mal_id > 0
      ? base.mal_id
      : typeof base.external_ids?.mal_id === "number" && base.external_ids.mal_id > 0
        ? base.external_ids.mal_id
        : typeof fallback?.mal_id === "number" && fallback.mal_id > 0
          ? fallback.mal_id
          : typeof fallback?.external_ids?.mal_id === "number" && fallback.external_ids.mal_id > 0
            ? fallback.external_ids.mal_id
            : null;

  let url: string | null = null;
  if (aid != null) url = `/api/anilist/media?anilistId=${aid}`;
  else if (malRaw != null) url = `/api/anilist/media?idMal=${malRaw}`;
  else return base;

  try {
    const res = await fetch(url);
    if (!res.ok) return base;
    const ani = (await res.json()) as AnilistMediaPayload & { error?: string };
    if (!ani || typeof ani !== "object" || "error" in ani) return base;
    if (typeof ani.id !== "number") return base;
    return mergeAnilistIntoShow(base, ani, fallback);
  } catch {
    return base;
  }
}

export type ShowServerKey = StreamServerId;

/** Episode picker: tabs 0–99, 100–199, … (labels); grid uses 1-based episode numbers. */
const EPISODE_RANGE_BLOCK = 100;

export default function ShowTemplate({ id }: { id: string }) {
  const baseUrl = "https://image.tmdb.org/t/p/";
  const size = "w500";
  const { server } = useStreamingSource();
  const [show, setShow] = useState<Show | null>(null);
  const [resolvedPlayerId, setResolvedPlayerId] = useState<string>(id);
  const [loading, setLoading] = useState(true);
  /** TMDB movie id for anime films (AniList format MOVIE/MUSIC), resolved via /api/anime/resolve-movie. */
  const [animeMovieTmdbId, setAnimeMovieTmdbId] = useState<string | null>(null);
  const [animeMovieResolving, setAnimeMovieResolving] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  /** First episode index in current block: 0 → eps 1–100, 100 → 101–200, … */
  const [episodeRangeStart, setEpisodeRangeStart] = useState(0);
  /** null = no cap (anime / error); number = last episode number aired by TMDB calendar */
  const [tmdbAiredEpCap, setTmdbAiredEpCap] = useState<number | null>(null);
  const [tmdbEpCapLoading, setTmdbEpCapLoading] = useState(false);
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(
    () => new Set()
  );
  const [progressHydrated, setProgressHydrated] = useState(false);
  const progressAppliedForIdRef = useRef<string | null>(null);

  useEffect(() => {
    progressAppliedForIdRef.current = null;
    setProgressHydrated(false);
  }, [id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!show || loading) return;
    if (progressAppliedForIdRef.current === id) return;

    const saved = loadWatchProgress(String(id));
    if (saved) {
      const aniIdH = catalogAnilistId(show);
      const playerAniH = Boolean(show.is_anime) && aniIdH != null;
      const movieH =
        show.anilist?.format === "MOVIE" || show.anilist?.format === "MUSIC";
      const aniOnlyH = playerAniH && !movieH;
      if (aniOnlyH) {
        const capH = anilistEpisodeCap(show);
        const sumH = tmdbSeasonsWithEpisodes(show.seasons).reduce(
          (acc, s) => acc + (typeof s.episode_count === "number" ? s.episode_count : 0),
          0
        );
        const maxEp =
          capH ??
          (typeof show.number_of_episodes === "number" && show.number_of_episodes > 0
            ? show.number_of_episodes
            : sumH > 0
              ? sumH
              : 0);
        setSelectedSeason(1);
        if (maxEp > 0 && saved.lastSeason === 1 && saved.lastEpisode >= 1 && saved.lastEpisode <= maxEp) {
          setSelectedEpisode(saved.lastEpisode);
        } else {
          setSelectedEpisode(1);
        }
      } else {
        const list = tmdbSeasonsWithEpisodes(show.seasons);
        const seasonObj = list.find((s) => s.season_number === saved.lastSeason);
        const max = seasonObj?.episode_count ?? 0;
        if (max > 0 && saved.lastEpisode >= 1 && saved.lastEpisode <= max) {
          setSelectedSeason(saved.lastSeason);
          setSelectedEpisode(saved.lastEpisode);
        }
      }
      setWatchedEpisodes(new Set(saved.watched));
    } else {
      setWatchedEpisodes(new Set());
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
        setResolvedPlayerId(id);

        let targetTmdbId = id;
        let fallbackShow: Show | null = null;
        const isNumericId = /^\d+$/.test(id);

        if (!isNumericId) {
          const resolveRes = await fetch(`/api/tv/resolve?id=${encodeURIComponent(id)}`);
          if (resolveRes.ok) {
            const resolved = await resolveRes.json();
            if (resolved?.playerId != null) {
              targetTmdbId = String(resolved.playerId);
              setResolvedPlayerId(String(resolved.playerId));
            }
            if (resolved?.fallback && typeof resolved.fallback === "object") {
              fallbackShow = resolved.fallback as Show;
            }
          }
        }

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
          const merged = await fetchAnilistAndMerge(fallbackShow, fallbackShow);
          const today = catalogTodayYmdUtc();
          if (merged.seasons?.length && !merged.is_anime) {
            merged.seasons = filterReleasedSeasons(merged.seasons, today) ?? merged.seasons;
          }
          const forUi = withAnimeFlatEpisodeLayout(merged);
          setShow(forUi);
          pickFirstSeason(forUi.seasons);
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
            const merged = await fetchAnilistAndMerge(fallbackShow, fallbackShow);
            const today = catalogTodayYmdUtc();
            if (merged.seasons?.length && !merged.is_anime) {
              merged.seasons = filterReleasedSeasons(merged.seasons, today) ?? merged.seasons;
            }
            const forUi = withAnimeFlatEpisodeLayout(merged);
            setShow(forUi);
            pickFirstSeason(forUi.seasons);
            setSelectedEpisode(1);
            return;
          }
          throw new Error("Failed to fetch show details");
        }
        const data = (await res.json()) as Show;
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
        const merged = await fetchAnilistAndMerge(forAni, fallbackShow);
        if (merged.seasons?.length && !merged.is_anime) {
          merged.seasons = filterReleasedSeasons(merged.seasons, todayYmd) ?? merged.seasons;
        }
        if (tmdbSeasonsPlayback?.length) {
          merged.tmdb_playback_seasons = tmdbSeasonsPlayback;
          if (merged.is_anime) {
            const list = tmdbSeasonsWithEpisodes(tmdbSeasonsPlayback as Season[]);
            merged.seasons = list;
            merged.number_of_seasons = list.length;
            merged.number_of_episodes = list.reduce(
              (acc, s) =>
                acc + (typeof s.episode_count === "number" ? s.episode_count : 0),
              0
            );
          }
        }
        const forUi = withAnimeFlatEpisodeLayout(merged);
        setShow(forUi);
        pickFirstSeason(forUi.seasons);
        setSelectedEpisode(1);
      } catch {
        /* keep prior show on transient errors */
      } finally {
        setLoading(false);
      }
    };
    fetchShowDetails();
  }, [id]);

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
    const released = show.seasons?.filter((s) => s.season_number >= 1) ?? [];
    const multiSeason = released.length > 1;
    const cum =
      (multiSeason ? episodeOffsetBeforeSeason(show.seasons, selectedSeason) : 0) +
      selectedEpisode;
    const playerAni = Boolean(show.is_anime) && catalogAnilistId(show) != null;
    const aniMovieTitle =
      show.anilist?.format === "MOVIE" || show.anilist?.format === "MUSIC";
    const aniListOnlyTitle = playerAni && !aniMovieTitle;
    const seasonEpisode = aniListOnlyTitle
      ? `Ep ${selectedEpisode}`
      : multiSeason && playerAni
        ? `S${selectedSeason} · E${selectedEpisode} (#${cum})`
        : multiSeason && !playerAni
          ? `S${selectedSeason}E${selectedEpisode}`
        : multiSeason
          ? `S${selectedSeason} · Ep ${cum}`
          : `S${selectedSeason}E${selectedEpisode}`;
    document.title = year
      ? `${displayName} (${year}) ${seasonEpisode} - Teavie`
      : `${displayName} ${seasonEpisode} - Teavie`;
  }, [show, selectedSeason, selectedEpisode]);

  useEffect(() => {
    if (!show || !/^\d+$/.test(String(resolvedPlayerId))) {
      setTmdbAiredEpCap(null);
      setTmdbEpCapLoading(false);
      return;
    }
    if (show.is_anime && catalogAnilistId(show) != null) {
      setTmdbAiredEpCap(null);
      setTmdbEpCapLoading(false);
      return;
    }
    const releasedSeasonCount =
      show.seasons?.filter((s) => s.season_number >= 1).length ?? 0;
    const aniMovieSkip =
      show.anilist?.format === "MOVIE" || show.anilist?.format === "MUSIC";
    const useAnilistOnlyEpSkip =
      Boolean(show.is_anime) && catalogAnilistId(show) != null && !aniMovieSkip;
    const skipSeasonFetchForFlatAnimePicker =
      releasedSeasonCount > 1 &&
      !useAnilistOnlyEpSkip &&
      Boolean(show.is_anime);
    if (skipSeasonFetchForFlatAnimePicker) {
      setTmdbAiredEpCap(null);
      setTmdbEpCapLoading(false);
      return;
    }

    let cancelled = false;
    setTmdbEpCapLoading(true);
    setTmdbAiredEpCap(null);

    const run = async () => {
      const token = process.env.NEXT_PUBLIC_TMDB_BEARER;
      if (!token) {
        if (!cancelled) {
          setTmdbAiredEpCap(null);
          setTmdbEpCapLoading(false);
        }
        return;
      }
      try {
        const url = `https://api.themoviedb.org/3/tv/${resolvedPlayerId}/season/${selectedSeason}?language=en-US`;
        const res = await fetch(url, {
          headers: { accept: "application/json", Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("season fetch failed");
        const json = (await res.json()) as {
          air_date?: string | null;
          episodes?: { air_date?: string | null; episode_number?: number }[];
        };
        const today = catalogTodayYmdUtc();
        let max = 0;
        const eps = json.episodes ?? [];
        for (const ep of eps) {
          const ad = String(ep.air_date ?? "").trim();
          if (!ad || ad.length < 10) continue;
          if (ad > today) continue;
          const n = Number(ep.episode_number);
          if (Number.isFinite(n) && n > max) max = n;
        }
        const seasonAir = String(json.air_date ?? "").trim();
        if (max === 0 && eps.length > 0 && seasonAir.length >= 10 && seasonAir <= today) {
          max = eps.length;
        }
        if (!cancelled) setTmdbAiredEpCap(max);
      } catch {
        if (!cancelled) setTmdbAiredEpCap(null);
      } finally {
        if (!cancelled) setTmdbEpCapLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [show, resolvedPlayerId, selectedSeason]);

  useEffect(() => {
    if (tmdbEpCapLoading) return;
    if (tmdbAiredEpCap != null && tmdbAiredEpCap > 0 && selectedEpisode > tmdbAiredEpCap) {
      setSelectedEpisode(tmdbAiredEpCap);
    }
  }, [tmdbEpCapLoading, tmdbAiredEpCap, selectedEpisode]);

  const currentSeason = show?.seasons?.find((s) => s.season_number === selectedSeason);
  const rawEpisodeCount = currentSeason?.episode_count ?? 0;
  const releasedSeasonsForUi = show?.seasons?.filter((s) => s.season_number >= 1) ?? [];
  const totalEpisodesAcrossSeasons = tmdbSeasonsWithEpisodes(show?.seasons).reduce(
    (acc, s) => acc + (typeof s.episode_count === "number" ? s.episode_count : 0),
    0
  );
  const resolvedIsNumeric = /^\d+$/.test(String(resolvedPlayerId));
  const aniId = catalogAnilistId(show);
  /** MAL id from `/shows/anime_{malId}` or doc — drives AniList APIs when `anilist_id` is missing. */
  const idMalForAnilistRails = catalogMalIdForAnilistApi(show, id);
  const showAnimeRelated =
    !loading &&
    show != null &&
    Boolean(show.is_anime) &&
    idMalForAnilistRails != null;
  // Anime now plays through the standard TMDB TV embed (/tv/{id}/{season}/{episode}),
  // same as live-action shows. The AniList /anime embed is only a last resort for
  // anime that never resolve a TMDB id.
  const playerUsesTmdb = resolvedIsNumeric;
  const playerUsesAnilist =
    !playerUsesTmdb && Boolean(show?.is_anime) && aniId != null;
  const aniListEpCap = anilistEpisodeCap(show);
  /** Anime film (AniList format MOVIE/MUSIC): single playback, no episode picker. */
  const isAnimeMovie =
    Boolean(show?.is_anime) &&
    (show?.anilist?.format === "MOVIE" || show?.anilist?.format === "MUSIC");
  const animeMovieEmbed =
    playerUsesAnilist &&
    (show?.anilist?.format === "MOVIE" || show?.anilist?.format === "MUSIC");
  /** TV series on AniList: flat 1…N picker only (no TMDB season / cumulative map). */
  const useAnilistOnlyEpisodePicker = playerUsesAnilist && !animeMovieEmbed;
  /**
   * Multi-season **anime** without AniList-only picker: one flat cumulative episode grid (TMDB layout).
   * Live-action TMDB TV uses per-season tabs + per-season episode indices.
   */
  const useFlatAllEpisodesPicker =
    !useAnilistOnlyEpisodePicker &&
    releasedSeasonsForUi.length > 1 &&
    Boolean(show?.is_anime);
  const anilistPickerTotal =
    aniListEpCap ??
    (typeof show?.number_of_episodes === "number" && show.number_of_episodes > 0
      ? show.number_of_episodes
      : null) ??
    (totalEpisodesAcrossSeasons > 0 ? totalEpisodesAcrossSeasons : null);
  const flatEpisodesMax =
    playerUsesAnilist && useFlatAllEpisodesPicker && aniListEpCap != null
      ? Math.min(totalEpisodesAcrossSeasons, aniListEpCap)
      : totalEpisodesAcrossSeasons;
  /** TMDB /season/{n} air dates for capping the episode grid (season index matches TMDB for all TMDB playback). */
  const useTmdbSeasonAiringCap = Boolean(show && playerUsesTmdb);
  /** Per-season aired cap only when the grid is per-season (not the all-episodes flat list). */
  const useTmdbSeasonAiringCapForPlayer =
    useTmdbSeasonAiringCap && !useFlatAllEpisodesPicker && !useAnilistOnlyEpisodePicker;

  let displayEpisodeCount = rawEpisodeCount;
  let episodeGridStatus: "normal" | "loading" | "none" = "normal";
  if (useAnilistOnlyEpisodePicker) {
    const n = anilistPickerTotal;
    displayEpisodeCount = typeof n === "number" && n > 0 ? n : 0;
    episodeGridStatus = displayEpisodeCount > 0 ? "normal" : "none";
  } else if (useFlatAllEpisodesPicker) {
    displayEpisodeCount = flatEpisodesMax;
    episodeGridStatus = flatEpisodesMax > 0 ? "normal" : "none";
  } else if (useTmdbSeasonAiringCap) {
    if (tmdbEpCapLoading) {
      episodeGridStatus = "loading";
      displayEpisodeCount = 0;
    } else if (tmdbAiredEpCap === 0 && rawEpisodeCount > 0) {
      episodeGridStatus = "none";
      displayEpisodeCount = 0;
    } else if (tmdbAiredEpCap != null && tmdbAiredEpCap > 0) {
      displayEpisodeCount = Math.min(rawEpisodeCount, tmdbAiredEpCap);
    }
  }

  const tmdbShowPremiered =
    !show ||
    !show.first_air_date ||
    String(show.first_air_date).trim().length < 10 ||
    String(show.first_air_date).slice(0, 10) <= catalogTodayYmdUtc();
  const canPlay = playerUsesAnilist || (playerUsesTmdb && tmdbShowPremiered);
  const absoluteEpisodeForPlayer = (() => {
    if (useAnilistOnlyEpisodePicker) {
      const e = Math.max(1, Math.floor(Number(selectedEpisode)) || 1);
      const max =
        aniListEpCap ??
        (typeof anilistPickerTotal === "number" && anilistPickerTotal > 0
          ? anilistPickerTotal
          : null);
      if (max != null && max > 0) return Math.min(e, max);
      return e;
    }
    if (playerUsesAnilist && show) {
      const raw = cumulativeTvEpisode(show.seasons, selectedSeason, selectedEpisode);
      return aniListEpCap != null ? Math.min(Math.max(1, raw), aniListEpCap) : raw;
    }
    return 1;
  })();
  const imageUrl = show?.poster_path
    ? /^https?:\/\//i.test(show.poster_path)
      ? show.poster_path
      : `${baseUrl}${size}${show.poster_path}`
    : "";
  const title = show ? showDisplayTitle(show) : "";

  const animeHideSeasonRow =
    Boolean(show?.is_anime) && releasedSeasonsForUi.length <= 1;
  const showSeasonPickerStrip =
    !animeHideSeasonRow && !useFlatAllEpisodesPicker && !useAnilistOnlyEpisodePicker;
  const pickerSectionLabelClass = "text-xs font-medium text-default-500";
  const pickerButtonClass = (selected: boolean) =>
    selected
      ? "h-9 min-w-9 bg-foreground px-0 text-xs font-medium tabular-nums text-background"
      : "h-9 min-w-9 border border-default-300/70 bg-transparent px-0 text-xs font-medium tabular-nums dark:border-default-100/30";
  const useContinuousEpisodeLabels =
    !useAnilistOnlyEpisodePicker &&
    releasedSeasonsForUi.length > 1 &&
    useFlatAllEpisodesPicker;
  const episodeDisplayOffset =
    useContinuousEpisodeLabels && show
      ? episodeOffsetBeforeSeason(show.seasons, selectedSeason)
      : 0;
  const cumulativeEpisodeSelected = episodeDisplayOffset + selectedEpisode;

  useEffect(() => {
    if (useAnilistOnlyEpisodePicker || !show?.seasons?.length || !useFlatAllEpisodesPicker || !playerUsesAnilist) return;
    if (aniListEpCap == null || flatEpisodesMax <= 0) return;
    const cur = cumulativeTvEpisode(show.seasons, selectedSeason, selectedEpisode);
    if (cur <= flatEpisodesMax) return;
    const coords = tmdbSeasonEpisodeFromAbsolute(show.seasons, flatEpisodesMax);
    setSelectedSeason(coords.season);
    setSelectedEpisode(coords.episode);
  }, [
    show,
    useAnilistOnlyEpisodePicker,
    useFlatAllEpisodesPicker,
    playerUsesAnilist,
    aniListEpCap,
    flatEpisodesMax,
    selectedSeason,
    selectedEpisode,
  ]);

  useEffect(() => {
    if (!useAnilistOnlyEpisodePicker) return;
    if (selectedSeason !== 1) setSelectedSeason(1);
  }, [useAnilistOnlyEpisodePicker, selectedSeason]);

  useEffect(() => {
    if (!useAnilistOnlyEpisodePicker) return;
    if (displayEpisodeCount > 0 && selectedEpisode > displayEpisodeCount) {
      setSelectedEpisode(displayEpisodeCount);
    }
  }, [useAnilistOnlyEpisodePicker, displayEpisodeCount, selectedEpisode]);

  const episodeBlockLo =
    displayEpisodeCount > 0 ? episodeRangeStart + 1 : 1;
  const episodeBlockHi =
    displayEpisodeCount > 0
      ? Math.min(episodeRangeStart + EPISODE_RANGE_BLOCK, displayEpisodeCount)
      : 0;
  const showEpisodeRangeTabs = displayEpisodeCount > EPISODE_RANGE_BLOCK;

  useEffect(() => {
    setEpisodeRangeStart(0);
  }, [id]);

  useEffect(() => {
    if (useFlatAllEpisodesPicker || useAnilistOnlyEpisodePicker) return;
    setEpisodeRangeStart(0);
  }, [selectedSeason, useFlatAllEpisodesPicker, useAnilistOnlyEpisodePicker]);

  useEffect(() => {
    if (!useFlatAllEpisodesPicker && !useAnilistOnlyEpisodePicker) return;
    const c = useAnilistOnlyEpisodePicker ? selectedEpisode : cumulativeEpisodeSelected;
    const start =
      Math.floor(Math.max(0, c - 1) / EPISODE_RANGE_BLOCK) * EPISODE_RANGE_BLOCK;
    setEpisodeRangeStart(start);
  }, [
    useFlatAllEpisodesPicker,
    useAnilistOnlyEpisodePicker,
    cumulativeEpisodeSelected,
    selectedEpisode,
  ]);

  useEffect(() => {
    if (displayEpisodeCount <= 0) return;
    const maxStart =
      Math.max(0, Math.floor((displayEpisodeCount - 1) / EPISODE_RANGE_BLOCK)) *
      EPISODE_RANGE_BLOCK;
    setEpisodeRangeStart((s) => Math.min(s, maxStart));
  }, [displayEpisodeCount]);

  return (
    <div className="flex min-h-full w-full flex-col bg-background/92 px-0 py-4 pb-32 dark:bg-background/88">
      <div className="w-full flex flex-col gap-6">

        {/* ── Video Player (horizontal inset matches root py-4 / px-4) ── */}
        <div className="aspect-video w-full max-h-[52vh] min-h-[200px] shrink-0 overflow-hidden rounded-xl bg-default-200 sm:max-h-[70vh] lg:aspect-auto lg:h-[min(80vh,900px)] lg:max-h-[80vh]">
          {loading ? (
            <div className="h-full w-full animate-pulse bg-default-200" />
          ) : isAnimeMovie ? (
            animeMovieResolving ? (
              <div className="flex h-full w-full items-center justify-center bg-black/80 px-6 text-center text-sm text-white/70">
                Loading player…
              </div>
            ) : animeMovieTmdbId ? (
              <MoviePlayer key={`movie-${id}`} videoId={animeMovieTmdbId} server={server} />
            ) : playerUsesAnilist && aniId != null ? (
              <ShowPlayer
                key={id}
                server={server}
                source="anilist"
                anilistId={aniId}
                absoluteEpisode={1}
                animeMovie
                season={1}
                episode={1}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-black/80 px-6 text-center text-sm text-white/70">
                No playback source available for this page yet. Try again later.
              </div>
            )
          ) : !canPlay ? (
            <div className="flex h-full w-full items-center justify-center bg-black/80 px-6 text-center text-sm text-white/70">
              {playerUsesTmdb && show && !tmdbShowPremiered
                ? `This series has not premiered yet (first episode ${String(show.first_air_date).slice(0, 10)}).`
                : "No playback source available for this page yet. Try again later."}
            </div>
          ) : useTmdbSeasonAiringCapForPlayer && tmdbEpCapLoading ? (
            <div className="flex h-full w-full items-center justify-center bg-black/80 px-6 text-center text-sm text-white/70">
              Loading aired episodes…
            </div>
          ) : useTmdbSeasonAiringCapForPlayer && displayEpisodeCount < 1 ? (
            <div className="flex h-full w-full items-center justify-center bg-black/80 px-6 text-center text-sm text-white/70">
              No released episodes to play in this season yet.
            </div>
          ) : (
            <ShowPlayer
              key={id}
              server={server}
              source={playerUsesAnilist ? "anilist" : "tmdb"}
              videoId={playerUsesTmdb ? resolvedPlayerId : undefined}
              anilistId={playerUsesAnilist ? aniId : undefined}
              absoluteEpisode={absoluteEpisodeForPlayer}
              animeMovie={animeMovieEmbed}
              season={selectedSeason}
              episode={selectedEpisode}
            />
          )}
        </div>

        {/* ── Show Details ── */}
        <div className="w-full">
          {loading ? (
            <CatalogMediaPanelSkeleton withSeasonPicker />
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
                genres={show.genres ?? []}
                infoLines={buildShowInfoLines(show)}
                links={showDetailLinks(show)}
                seasonEpisodeSection={
                  !isAnimeMovie ? (
                    <div className="flex flex-col gap-4">
                      {showSeasonPickerStrip ? (
                        <div className="flex flex-col gap-2">
                          <p className={pickerSectionLabelClass}>Season</p>
                          <div className="flex flex-wrap gap-2">
                            {show.seasons
                              ?.filter((s) => s.season_number >= 1)
                              .map((s) => {
                                const sel = selectedSeason === s.season_number;
                                return (
                                  <Button
                                    key={s.season_number}
                                    size="sm"
                                    radius="full"
                                    variant="light"
                                    className={pickerButtonClass(sel)}
                                    onPress={() => {
                                      setSelectedSeason(s.season_number);
                                      setSelectedEpisode(1);
                                    }}
                                  >
                                    S{s.season_number}
                                  </Button>
                                );
                              })}
                          </div>
                        </div>
                      ) : null}

                      <div className="flex flex-col gap-2">
                        <p className={pickerSectionLabelClass}>Episode</p>

                        {episodeGridStatus === "loading" && (
                          <div className="rounded-lg bg-default-100/80 px-2 py-4 text-center text-xs text-default-500 dark:bg-default-50/10">
                            Loading episodes…
                          </div>
                        )}
                        {episodeGridStatus === "none" && (
                          <div className="rounded-lg bg-default-100/80 px-2 py-4 text-center text-xs text-default-500 dark:bg-default-50/10">
                            {useAnilistOnlyEpisodePicker
                              ? "Episode list not ready yet."
                              : "Nothing to show for this season yet."}
                          </div>
                        )}
                        {episodeGridStatus === "normal" && displayEpisodeCount > 0 && (
                          <div className="flex flex-col gap-2">
                            {showEpisodeRangeTabs && (
                              <div className="flex flex-wrap gap-1.5">
                                {Array.from(
                                  { length: Math.ceil(displayEpisodeCount / EPISODE_RANGE_BLOCK) },
                                  (_, b) => {
                                    const start = b * EPISODE_RANGE_BLOCK;
                                    const labelHi = Math.min(
                                      start + EPISODE_RANGE_BLOCK - 1,
                                      displayEpisodeCount - 1
                                    );
                                    const withinLo = start + 1;
                                    const withinHi = Math.min(
                                      start + EPISODE_RANGE_BLOCK,
                                      displayEpisodeCount
                                    );
                                    const rangeLabel = useFlatAllEpisodesPicker
                                      ? `${withinLo}–${withinHi}`
                                      : useContinuousEpisodeLabels
                                        ? `${withinLo + episodeDisplayOffset}–${withinHi + episodeDisplayOffset}`
                                        : `${start}–${labelHi}`;
                                    const rangeSel = episodeRangeStart === start;
                                    return (
                                      <Button
                                        key={start}
                                        size="sm"
                                        radius="full"
                                        variant="light"
                                        className={pickerButtonClass(rangeSel)}
                                        onPress={() => setEpisodeRangeStart(start)}
                                      >
                                        {rangeLabel}
                                      </Button>
                                    );
                                  }
                                )}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {Array.from(
                                { length: Math.max(0, episodeBlockHi - episodeBlockLo + 1) },
                                (_, i) => episodeBlockLo + i
                              ).map((ep) => {
                                const coordsFlat =
                                  useFlatAllEpisodesPicker && show?.seasons
                                    ? tmdbSeasonEpisodeFromAbsolute(show.seasons, ep)
                                    : null;
                                const watchKey = useAnilistOnlyEpisodePicker
                                  ? formatWatchEpKey(1, ep)
                                  : coordsFlat
                                    ? formatWatchEpKey(coordsFlat.season, coordsFlat.episode)
                                    : formatWatchEpKey(selectedSeason, ep);
                                const watchedThis = watchedEpisodes.has(watchKey);
                                const epLabel = useAnilistOnlyEpisodePicker
                                  ? ep
                                  : useFlatAllEpisodesPicker
                                    ? ep
                                    : useContinuousEpisodeLabels
                                      ? ep + episodeDisplayOffset
                                      : ep;
                                const isCurrent = useFlatAllEpisodesPicker
                                  ? cumulativeEpisodeSelected === ep
                                  : selectedEpisode === ep;
                                const ariaEp = `Episode ${epLabel}`;
                                return (
                                  <div key={ep} className="relative">
                                    <Button
                                      size="sm"
                                      radius="full"
                                      variant="light"
                                      className={pickerButtonClass(isCurrent)}
                                      aria-label={
                                        watchedThis ? `${ariaEp}, watched` : ariaEp
                                      }
                                      onPress={() => {
                                        if (coordsFlat) {
                                          setSelectedSeason(coordsFlat.season);
                                          setSelectedEpisode(coordsFlat.episode);
                                          setWatchedEpisodes((prev) => {
                                            const next = new Set(prev);
                                            next.add(
                                              formatWatchEpKey(
                                                coordsFlat.season,
                                                coordsFlat.episode
                                              )
                                            );
                                            return next;
                                          });
                                        } else if (useAnilistOnlyEpisodePicker) {
                                          setSelectedSeason(1);
                                          setSelectedEpisode(ep);
                                          setWatchedEpisodes((prev) => {
                                            const next = new Set(prev);
                                            next.add(formatWatchEpKey(1, ep));
                                            return next;
                                          });
                                        } else {
                                          setSelectedEpisode(ep);
                                          setWatchedEpisodes((prev) => {
                                            const next = new Set(prev);
                                            next.add(formatWatchEpKey(selectedSeason, ep));
                                            return next;
                                          });
                                        }
                                      }}
                                    >
                                      {epLabel}
                                    </Button>
                                    {watchedThis ? (
                                      <span
                                        className="pointer-events-none absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-success shadow-sm ring-2 ring-background"
                                        aria-hidden
                                      />
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : undefined
                }
              />
            )
          )}
        </div>

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
      </div>
    </div>
  );
}

