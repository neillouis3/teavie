'use client';

import React, { useState, useEffect, useRef } from "react";
import ShowPlayer from "./showPlayer";
import YouMightLike from "./youMightLike";
import AnimeRelatedSection from "./animeRelatedSection";
import {
  cumulativeTvEpisode,
  tmdbSeasonEpisodeFromAbsolute,
} from "@/lib/cumulativeTvEpisode";
import { Image, Chip, Button } from "@heroui/react";
import {
  useStreamingSource,
  type StreamServerId,
} from "@/contexts/streamingSourceContext";
import {
  formatWatchEpKey,
  loadWatchProgress,
  saveWatchProgress,
} from "@/lib/watchProgress";

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
  tagline?: string | null;
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
  } | null;
  /** TMDB season layout: when set on anime, picker uses these counts and embed uses same S/E as the UI. */
  tmdb_playback_seasons?: Season[];
  /** Catalog or merged TMDB id for TV; used for TMDB recommendations on anime pages. */
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

function catalogTmdbTvId(show: Show | null | undefined): number | null {
  if (!show) return null;
  const raw =
    show.tmdb_id ??
    (typeof show.external_ids?.tmdb_id === "number"
      ? show.external_ids.tmdb_id
      : typeof show.external_ids?.tmdb_id === "string"
        ? parseInt(show.external_ids.tmdb_id, 10)
        : null);
  const t =
    typeof raw === "number" ? raw : typeof raw === "string" ? parseInt(raw, 10) : NaN;
  return Number.isFinite(t) && t > 0 ? t : null;
}

type AnilistMediaPayload = {
  id: number;
  idMal?: number | null;
  siteUrl?: string | null;
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
  } else if (next.is_anime && goodTmdb.length > 0) {
    const total = goodTmdb.reduce(
      (acc, s) => acc + (typeof s.episode_count === "number" ? s.episode_count : 0),
      0
    );
    if (total > 0) {
      next.seasons = [{ season_number: 1, episode_count: total }];
      next.number_of_seasons = 1;
      next.number_of_episodes = total;
    }
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

        const url = `https://api.themoviedb.org/3/tv/${targetTmdbId}?language=en-US`;
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

  useEffect(() => {
    if (show?.name) {
      const year = show.first_air_date?.slice(0, 4);
      const multiSeason =
        (show.seasons?.filter((s) => s.season_number >= 1).length ?? 0) > 1;
      const cum =
        (multiSeason ? episodeOffsetBeforeSeason(show.seasons, selectedSeason) : 0) +
        selectedEpisode;
      const seasonEpisode = multiSeason
        ? `S${selectedSeason} · Ep ${cum}`
        : `S${selectedSeason}E${selectedEpisode}`;
      document.title = year
        ? `${show.name} (${year}) ${seasonEpisode} - Teavie`
        : `${show.name} ${seasonEpisode} - Teavie`;
    }
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
    const multiSeasonPicker =
      (show.seasons?.filter((s) => s.season_number >= 1).length ?? 0) > 1;
    if (multiSeasonPicker) {
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
  const useFlatAllEpisodesPicker = releasedSeasonsForUi.length > 1;
  const totalEpisodesAcrossSeasons = tmdbSeasonsWithEpisodes(show?.seasons).reduce(
    (acc, s) => acc + (typeof s.episode_count === "number" ? s.episode_count : 0),
    0
  );
  const resolvedIsNumeric = /^\d+$/.test(String(resolvedPlayerId));
  const aniId = catalogAnilistId(show);
  const playerUsesAnilist = Boolean(show?.is_anime) && aniId != null;
  const playerUsesTmdb = !playerUsesAnilist && resolvedIsNumeric;
  /** TMDB /season/{n} air dates for capping the episode grid (season index matches TMDB for all TMDB playback). */
  const useTmdbSeasonAiringCap = Boolean(show && playerUsesTmdb);
  /** Per-season aired cap only when the grid is per-season (not the all-episodes flat list). */
  const useTmdbSeasonAiringCapForPlayer =
    useTmdbSeasonAiringCap && !useFlatAllEpisodesPicker;

  let displayEpisodeCount = rawEpisodeCount;
  let episodeGridStatus: "normal" | "loading" | "none" = "normal";
  if (useFlatAllEpisodesPicker) {
    displayEpisodeCount = totalEpisodesAcrossSeasons;
    episodeGridStatus = totalEpisodesAcrossSeasons > 0 ? "normal" : "none";
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
  const animeMovieEmbed =
    playerUsesAnilist &&
    (show?.anilist?.format === "MOVIE" || show?.anilist?.format === "MUSIC");
  const absoluteEpisodeForPlayer =
    playerUsesAnilist && show
      ? cumulativeTvEpisode(show.seasons, selectedSeason, selectedEpisode)
      : 1;
  const imageUrl = show?.poster_path
    ? /^https?:\/\//i.test(show.poster_path)
      ? show.poster_path
      : `${baseUrl}${size}${show.poster_path}`
    : "";
  const title = show?.name ?? "";
  const year = show?.first_air_date?.slice(0, 4) ?? "TBA";
  const aniListUrl =
    show?.anilist?.siteUrl ||
    (aniId != null ? `https://anilist.co/anime/${aniId}` : null);
  const displayVote = Number(show?.vote_average);
  const voteLabel = Number.isFinite(displayVote) ? displayVote.toFixed(1) : "—";

  const animeHideSeasonRow =
    Boolean(show?.is_anime) && releasedSeasonsForUi.length <= 1;
  const useContinuousEpisodeLabels = releasedSeasonsForUi.length > 1;
  const episodeDisplayOffset =
    useContinuousEpisodeLabels && show
      ? episodeOffsetBeforeSeason(show.seasons, selectedSeason)
      : 0;
  const cumulativeEpisodeSelected = episodeDisplayOffset + selectedEpisode;

  const showAnimeRelated =
    !loading && show != null && Boolean(show.is_anime) && aniId != null;

  const tmdbTvIdForRelated = (() => {
    const fromDoc = catalogTmdbTvId(show);
    if (fromDoc != null) return fromDoc;
    if (resolvedIsNumeric) {
      const n = parseInt(String(resolvedPlayerId), 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return null;
  })();

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
    if (useFlatAllEpisodesPicker) return;
    setEpisodeRangeStart(0);
  }, [selectedSeason, useFlatAllEpisodesPicker]);

  useEffect(() => {
    if (!useFlatAllEpisodesPicker) return;
    const c = cumulativeEpisodeSelected;
    const start =
      Math.floor(Math.max(0, c - 1) / EPISODE_RANGE_BLOCK) * EPISODE_RANGE_BLOCK;
    setEpisodeRangeStart(start);
  }, [useFlatAllEpisodesPicker, cumulativeEpisodeSelected]);

  useEffect(() => {
    if (displayEpisodeCount <= 0) return;
    const maxStart =
      Math.max(0, Math.floor((displayEpisodeCount - 1) / EPISODE_RANGE_BLOCK)) *
      EPISODE_RANGE_BLOCK;
    setEpisodeRangeStart((s) => Math.min(s, maxStart));
  }, [displayEpisodeCount]);

  return (
    <div className="bg-background min-h-full w-full flex flex-col px-0 py-4 pb-32">
      <div className="w-full flex flex-col gap-6">

        {/* ── Video Player (horizontal inset matches root py-4 / px-4) ── */}
        <div className="aspect-video w-full max-h-[52vh] min-h-[200px] shrink-0 overflow-hidden rounded-xl bg-default-200 sm:max-h-[70vh] lg:aspect-auto lg:h-[min(80vh,900px)] lg:max-h-[80vh]">
          {loading ? (
            <div className="h-full w-full animate-pulse bg-default-200" />
          ) : !canPlay ? (
            <div className="flex h-full w-full items-center justify-center bg-black/80 px-6 text-center text-sm text-white/70">
              {playerUsesTmdb && show && !tmdbShowPremiered
                ? `This series has not premiered yet (first episode ${String(show.first_air_date).slice(0, 10)}).`
                : "No TMDB TV id and no AniList id available for playback. Try again later or check AniList / TMDB."}
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
              episode={playerUsesTmdb ? cumulativeEpisodeSelected : selectedEpisode}
            />
          )}
        </div>

        {showAnimeRelated ? (
          <AnimeRelatedSection anilistId={aniId!} tmdbTvId={tmdbTvIdForRelated} />
        ) : null}

        {/* ── Show Details ── */}
        <div className="w-full flex flex-col gap-4">
          {loading ? (
            <LoadingSkeleton />
          ) : (
            show && (
              <>
                {/* ── Title + Meta ── */}
                <section>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
                    {title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Chip color="success" size="md" variant="flat" className="font-medium">
                      {show.is_anime ? "Anime" : "TV"}
                    </Chip>
                    <Chip
                      size="md"
                      variant="flat"
                      color="warning"
                      startContent={
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                          <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                        </svg>
                      }
                      className="font-medium"
                    >
                      {voteLabel}
                    </Chip>
                    <Chip size="md" variant="flat" className="font-medium">
                      {year}
                    </Chip>
                    <Chip size="md" variant="flat" className="font-medium capitalize">
                      {show.status}
                    </Chip>
                    {show.is_anime && show.anilist_id ? (
                      <a
                        href={aniListUrl || undefined}
                        target={aniListUrl ? "_blank" : undefined}
                        rel={aniListUrl ? "noreferrer noopener" : undefined}
                        className="inline-flex"
                      >
                        <Chip size="md" variant="flat" color="secondary" className="font-medium">
                          AniList #{show.anilist_id}
                        </Chip>
                      </a>
                    ) : null}
                  </div>
                </section>

                {/* ── Season & Episode Chooser ── */}
                <div className="rounded-xl border border-default-200/60 bg-default-100/60 dark:bg-default-100/20 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-default-200/60">
                    <span className="text-sm font-medium text-foreground">
                      {useFlatAllEpisodesPicker
                        ? "All episodes"
                        : show.is_anime
                          ? "Episodes"
                          : "Season & Episode"}
                    </span>
                    {show.is_anime ? (
                      typeof show.number_of_episodes === "number" && show.number_of_episodes > 0 ? (
                        <span className="text-xs text-default-500">
                          {show.number_of_episodes} episode{show.number_of_episodes === 1 ? "" : "s"}
                        </span>
                      ) : null
                    ) : (
                      show.number_of_seasons &&
                      show.number_of_episodes && (
                        <span className="text-xs text-default-500">
                          {show.number_of_seasons} seasons · {show.number_of_episodes} eps
                        </span>
                      )
                    )}
                  </div>

                  {/* Season pills — hidden for single-season anime, or when using one flat list for all eps */}
                  {!animeHideSeasonRow && !useFlatAllEpisodesPicker && (
                    <div className="px-4 pt-4 pb-3">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-default-500 mb-2.5">
                        Season
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {show.seasons
                          ?.filter((s) => s.season_number >= 1)
                          .map((s) => (
                            <Button
                              key={s.season_number}
                              size="sm"
                              variant={selectedSeason === s.season_number ? "solid" : "flat"}
                              color={selectedSeason === s.season_number ? "success" : "default"}
                              onPress={() => {
                                setSelectedSeason(s.season_number);
                                setSelectedEpisode(1);
                              }}
                            >
                              Season {s.season_number}
                            </Button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Episode grid */}
                  {episodeGridStatus === "loading" && (
                    <div
                      className={`px-4 pb-4 text-sm text-default-500${animeHideSeasonRow || useFlatAllEpisodesPicker ? " pt-4" : ""}`}
                    >
                      Loading aired episodes…
                    </div>
                  )}
                  {episodeGridStatus === "none" && (
                    <div
                      className={`px-4 pb-4 text-sm text-default-500${animeHideSeasonRow || useFlatAllEpisodesPicker ? " pt-4" : ""}`}
                    >
                      No episodes have aired in this season yet.
                    </div>
                  )}
                  {episodeGridStatus === "normal" && displayEpisodeCount > 0 && (
                    <div className={`px-4 pb-4${animeHideSeasonRow || useFlatAllEpisodesPicker ? " pt-4" : ""}`}>
                      {showEpisodeRangeTabs && (
                        <div className="mb-3">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-default-500 mb-2">
                            Range
                          </p>
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
                                return (
                                  <Button
                                    key={start}
                                    size="sm"
                                    variant={episodeRangeStart === start ? "solid" : "flat"}
                                    color={episodeRangeStart === start ? "success" : "default"}
                                    className="min-w-0 px-2.5 text-xs font-medium"
                                    onPress={() => setEpisodeRangeStart(start)}
                                  >
                                    {rangeLabel}
                                  </Button>
                                );
                              }
                            )}
                          </div>
                        </div>
                      )}
                      <p className="text-[11px] font-medium uppercase tracking-wider text-default-500 mb-2.5">
                        Episode
                        {selectedEpisode
                          ? ` — ${
                              useFlatAllEpisodesPicker || useContinuousEpisodeLabels
                                ? cumulativeEpisodeSelected
                                : selectedEpisode
                            }`
                          : ""}
                        {showEpisodeRangeTabs ? (
                          <span className="font-normal text-default-400 normal-case">
                            {" "}
                            (
                            {useFlatAllEpisodesPicker
                              ? `${episodeBlockLo}–${episodeBlockHi}`
                              : useContinuousEpisodeLabels
                                ? `${episodeBlockLo + episodeDisplayOffset}–${episodeBlockHi + episodeDisplayOffset}`
                                : `${episodeBlockLo}–${episodeBlockHi}`}
                            )
                          </span>
                        ) : null}
                      </p>
                      {progressHydrated ? (
                        <p className="mb-2 text-[10px] text-default-400">
                          Resume position and watched marks are saved in this browser.
                        </p>
                      ) : null}
                      <div
                        className="grid gap-1.5"
                        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))" }}
                      >
                        {Array.from(
                          { length: Math.max(0, episodeBlockHi - episodeBlockLo + 1) },
                          (_, i) => episodeBlockLo + i
                        ).map((ep) => {
                          const coordsFlat =
                            useFlatAllEpisodesPicker && show?.seasons
                              ? tmdbSeasonEpisodeFromAbsolute(show.seasons, ep)
                              : null;
                          const watchKey = coordsFlat
                            ? formatWatchEpKey(coordsFlat.season, coordsFlat.episode)
                            : formatWatchEpKey(selectedSeason, ep);
                          const watchedThis = watchedEpisodes.has(watchKey);
                          const epLabel = useFlatAllEpisodesPicker
                            ? ep
                            : useContinuousEpisodeLabels
                              ? ep + episodeDisplayOffset
                              : ep;
                          const isCurrent = useFlatAllEpisodesPicker
                            ? cumulativeEpisodeSelected === ep
                            : selectedEpisode === ep;
                          return (
                            <div key={ep} className="relative">
                              <Button
                                size="sm"
                                isIconOnly
                                variant={isCurrent ? "solid" : "flat"}
                                color={isCurrent ? "success" : "default"}
                                aria-label={
                                  watchedThis
                                    ? `Episode ${epLabel}, watched`
                                    : `Episode ${epLabel}`
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
                                  } else {
                                    setSelectedEpisode(ep);
                                    setWatchedEpisodes((prev) => {
                                      const next = new Set(prev);
                                      next.add(formatWatchEpKey(selectedSeason, ep));
                                      return next;
                                    });
                                  }
                                }}
                                className="aspect-square text-xs font-medium"
                              >
                                {epLabel}
                              </Button>
                              {watchedThis ? (
                                <span
                                  className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-success text-[10px] leading-none text-white shadow-sm ring-1 ring-black/20"
                                  aria-hidden
                                >
                                  {"\u2713"}
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Selection summary bar */}
                  <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-default-200/60 bg-default-50/50 dark:bg-default-100/10">
                    <Chip size="md" variant="flat" color="success" className="font-mono">
                      S{selectedSeason}
                    </Chip>
                    <span className="text-default-400 text-xs">›</span>
                    <Chip size="md" variant="flat" color="success" className="font-mono">
                      {`E${
                        useFlatAllEpisodesPicker || useContinuousEpisodeLabels
                          ? cumulativeEpisodeSelected
                          : selectedEpisode
                      }`}
                    </Chip>
                    {watchedEpisodes.size > 0 ? (
                      <Chip size="sm" variant="flat" className="ml-auto font-medium text-default-600">
                        {watchedEpisodes.size} marked watched
                      </Chip>
                    ) : null}
                  </div>
                </div>

                <section className="w-full  p-4 sm:p-5 rounded-xl bg-default-100/50 dark:bg-default-100/20 border border-default-200/50">
                  <div className="flex flex-row gap-4 sm:gap-6 lg:gap-8">
                    <div className="w-28 shrink-0 sm:w-36 md:w-40 lg:w-48">
                      <Image
                        src={imageUrl}
                        alt={title}
                        className="aspect-[2/3] w-full rounded-lg object-cover shadow-md"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm sm:text-base text-foreground/80 leading-relaxed">
                        {show.overview}
                      </p>
                      {show.tagline && (
                        <p className="mt-3 text-sm text-foreground/60 italic">
                          {show.tagline}
                        </p>
                      )}
                      <dl className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                        <div>
                          <dt className="text-default-500 font-medium">Country</dt>
                          <dd className="text-foreground mt-0.5">
                            {show.origin_country?.join(", ") || "N/A"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-default-500 font-medium">Genre</dt>
                          <dd className="text-foreground mt-0.5">
                            {show.genres?.map((g) => g.name).join(", ") ?? "N/A"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-default-500 font-medium">Year</dt>
                          <dd className="text-foreground mt-0.5">{year}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </section>
              </>
            )
          )}
        </div>

        {!loading && /^\d+$/.test(resolvedPlayerId) ? (
          <YouMightLike mediaType="tv" id={resolvedPlayerId} />
        ) : null}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <>
      <section className="w-full">
        <div className="h-8 sm:h-9 w-3/4 max-w-xl bg-default-200 rounded-lg animate-pulse" />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-6 w-14 rounded-full bg-default-200 animate-pulse" />
          ))}
        </div>
      </section>

      <div className="rounded-xl border border-default-200/60 bg-default-100/60 dark:bg-default-100/20 overflow-hidden">
        <div className="px-4 py-3.5 border-b border-default-200/60">
          <div className="h-4 w-36 bg-default-200 rounded animate-pulse" />
        </div>
        <div className="px-4 pt-4 pb-3">
          <div className="h-2.5 w-14 bg-default-200 rounded animate-pulse mb-2.5" />
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-20 bg-default-200 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="h-2.5 w-16 bg-default-200 rounded animate-pulse mb-2.5" />
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))" }}>
            {Array.from({ length: 13 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-default-200 animate-pulse" />
            ))}
          </div>
        </div>
      </div>

      <section className="w-full rounded-xl border border-default-200/60 overflow-hidden">
        <div className="flex flex-row gap-4">
          <div className="aspect-[2/3] w-28 shrink-0 animate-pulse bg-default-200 sm:w-36 md:w-40 lg:w-48" />
          <div className="flex-1 p-4 sm:p-5 space-y-4">
            <div className="space-y-2">
              {[90, 75, 55].map((w, i) => (
                <div key={i} className="h-3 bg-default-200 rounded animate-pulse" style={{ width: `${w}%` }} />
              ))}
            </div>
            <div className="h-px bg-default-200" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-2.5 w-12 bg-default-200 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-default-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
            <div className="h-px bg-default-200" />
            <div className="space-y-2">
              <div className="h-2.5 w-28 bg-default-200 rounded animate-pulse" />
              <div className="flex gap-1.5">
                <div className="h-8 w-20 bg-default-200 rounded-lg animate-pulse" />
                <div className="h-8 w-20 bg-default-200 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}