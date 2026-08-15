'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@heroui/react";
import AssetMaskIcon from "@/components/ui/assetMaskIcon";
import ShowPlayer from "./showPlayer";
import AnimePlayer from "./animePlayer";
import MoviePlayer from "./moviePlayer";
import YouMightLike from "./youMightLike";
import AnimeShowRails from "./animeShowRails";
import {
  cumulativeTvEpisode,
  tmdbSeasonEpisodeFromAbsolute,
} from "@/lib/cumulativeTvEpisode";
import { SHOW_VIDEO_PLAYER_ID } from "@/components/show/ShowEpisodePicker";
import {
  useStreamingSource,
  type StreamServerId,
} from "@/contexts/streamingSourceContext";
import { useAnimeAudio } from "@/contexts/animeAudioContext";
import {
  saveEpisodePlaybackPosition,
  loadEpisodePlaybackPosition,
} from "@/lib/watchProgress";
import type { MegaPlayMessage } from "@/lib/megaPlayProgress";
import { recordMovieInWatchHistory, touchWatchHistory } from "@/lib/watchHistory";
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
import CatalogMediaPanel, { CatalogTitleBlock } from "@/components/ui/catalogMediaPanel";
import WatchPageSkeleton from "@/components/ui/watchPageSkeleton";
import CatalogDetailsSkeleton from "@/components/ui/catalogDetailsSkeleton";
import DeferredModalSections from "@/components/ui/deferredModalSections";
import { PlayerEmbedSkeleton, PLAYER_SHELL_CLASS } from "@/components/ui/playerEmbedSkeleton";
import CatalogComingSoon from "@/components/ui/catalogComingSoon";
import CatalogUnavailable from "@/components/ui/catalogUnavailable";
import { usCertificationFromDoc } from "@/lib/mapContentDocToItem";
import { tmdbImageUrl, catalogHeroImageUrl } from "@/lib/tmdbImage";
import {
  isBlockedAdultAnimeDoc,
  isBlockedAdultTmdbTvShow,
} from "@/lib/animeContentPolicy";
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
import { pickAnilistYoutubeTrailerEmbedUrl } from "@/lib/anilistTrailer";
import { pickYoutubeTrailerEmbedUrl } from "@/lib/tmdbVideos";
import { SHOW_CONTENT_INSET_X } from "@/lib/contentInset";
import {
  fetchTvDetailsCached,
  fetchTvResolveCached,
} from "@/lib/catalogDetailsPrefetch";
import { resolveFrozenModalHeroBanner } from "@/lib/catalogModalHeroBanner";

import {
  type Season,
  type Show,
  type ShowTemplateViewMode,
  isAnimeShowPage,
  resolveShowDetailsBannerUrl,
  pickAnimeShowHeroBackdrop,
  catalogAnilistId,
  isKdramaShow,
  malIdFromAnimeCatalogRouteId,
  catalogMalIdForAnilistApi,
  catalogImdbId,
  anilistEpisodeCap,
  catalogAnimeEpisodeCount,
  fetchAnilistAndMerge,
  finalizeAnimeShowForUi,
  attachAnimeTrailerVideos,
  resolveAnimePlayerCoords,
  showDisplayTitle,
  tmdbSeasonsWithEpisodes,
  catalogTodayYmdUtc,
  filterReleasedSeasons,
  buildShowWatchHref,
  buildShowEpisodesHref,
} from "@/lib/showCatalogHelpers";
import { useShowWatchProgress } from "@/hooks/useShowWatchProgress";
import ShowEpisodesView from "@/components/show/ShowEpisodesView";
import ShowDetailsView from "@/components/show/ShowDetailsView";
import ShowWatchView from "@/components/show/ShowWatchView";
import {
  type CatalogDetailsSeed,
  type CatalogSeedFallback,
  mergeModalShow,
  preserveSeedBackdrop,
  seedBannerPath,
} from "@/lib/catalogDetailsSeed";

export type { ShowTemplateViewMode } from "@/lib/showCatalogHelpers";

function showToSeedFallback(show: Show | null | undefined): CatalogSeedFallback | null {
  if (!show) return null;
  return {
    title: show.name,
    overview: show.overview,
    release_date: show.first_air_date,
    poster_path: show.poster_path,
    backdrop_path: show.backdrop_path,
    vote_average: show.vote_average,
    imdb_genres: show.imdb_genres,
    omdb: show.omdb,
  };
}

function applyAnimeHeroArt(show: Show, fallback?: Show | null): Show {
  const poster = animePosterFromDoc(show);
  const backdrop = pickAnimeShowHeroBackdrop(show, fallback);
  return {
    ...show,
    ...(poster ? { poster_path: poster } : {}),
    ...(backdrop ? { backdrop_path: backdrop } : {}),
  };
}

function showFromSeed(id: string, seed: CatalogDetailsSeed): Show {
  return {
    id,
    name: seed.title,
    first_air_date: seed.releaseDate?.slice(0, 10) ?? "",
    overview: seed.overview ?? "",
    poster_path: seed.posterPath ?? null,
    backdrop_path: seed.backdropPath ?? seed.posterPath ?? null,
    vote_average: seed.voteAverage ?? 0,
    status: "",
    genres: [],
  };
}

export default function ShowTemplate({
  id,
  adminKey,
  adminPreview = false,
  viewMode = "details",
  detailsModal = false,
  detailsSeed = null,
  onDetailsNavigate,
}: {
  id: string;
  adminKey?: string;
  adminPreview?: boolean;
  viewMode?: ShowTemplateViewMode;
  detailsModal?: boolean;
  detailsSeed?: CatalogDetailsSeed | null;
  onDetailsNavigate?: () => void;
}) {
  const { server, hydrated: streamHydrated } = useStreamingSource();
  const { audio: animeAudio } = useAnimeAudio();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [show, setShow] = useState<Show | null>(() =>
    detailsModal && detailsSeed ? showFromSeed(id, detailsSeed) : null
  );
  const [resolvedPlayerId, setResolvedPlayerId] = useState<string>(id);
  const [loading, setLoading] = useState(() => !(detailsModal && detailsSeed));
  /** TMDB movie id for anime films (AniList format MOVIE/MUSIC), resolved via /api/anime/resolve-movie. */
  const [animeMovieTmdbId, setAnimeMovieTmdbId] = useState<string | null>(null);
  const [animeMovieResolving, setAnimeMovieResolving] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [pickerEpisodesLoading, setPickerEpisodesLoading] = useState(true);
  const [pickerPlayableCount, setPickerPlayableCount] = useState(0);
  const {
    watchedEpisodes,
    progressHydrated,
    markEpisodeWatched,
    markEpisodeWatchedFromPlayback,
  } = useShowWatchProgress(
    id,
    adminKey,
    show,
    loading,
    selectedSeason,
    selectedEpisode,
    setSelectedSeason,
    setSelectedEpisode
  );
  const [showUnavailableReason, setShowUnavailableReason] = useState<
    "content_policy" | "not_found" | "unauthorized" | null
  >(null);
  const [adminBypassActive, setAdminBypassActive] = useState(false);
  const [playerStartSeconds, setPlayerStartSeconds] = useState(0);
  const [playerEpoch, setPlayerEpoch] = useState(0);
  const [fetchedBannerUrl, setFetchedBannerUrl] = useState<string | null>(null);
  const partyPlaybackBroadcastRef = useRef(0);
  const lastPartyEpRef = useRef<string | null>(null);
  const modalHeroBannerRef = useRef<string | null>(null);
  const titleLogoId =
    animeMovieTmdbId ??
    (/^\d+$/.test(String(resolvedPlayerId)) ? String(resolvedPlayerId) : null);
  const titleLogoPath = useTmdbTitleLogo(
    animeMovieTmdbId ? "movie" : "tv",
    detailsModal ? null : titleLogoId
  );

  useEffect(() => {
    modalHeroBannerRef.current = null;
  }, [id, detailsModal]);

  useEffect(() => {
    if (!detailsModal) return;
    if (detailsSeed) {
      setShow(showFromSeed(id, detailsSeed));
    } else {
      setShow(null);
    }
  }, [id, detailsModal, detailsSeed]);

  useEffect(() => {
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
    const withSeed = (next: Show): Show =>
      detailsModal && detailsSeed ? preserveSeedBackdrop(next, detailsSeed) : next;

    const fetchShowDetails = async () => {
      try {
        setShowUnavailableReason(null);
        setAdminBypassActive(false);
        setResolvedPlayerId(id);
        if (detailsModal && detailsSeed) {
          setShow((current) => current ?? showFromSeed(id, detailsSeed));
        } else {
          setLoading(true);
          setShow(null);
        }

        let targetTmdbId = id;
        let fallbackShow: Show | null = null;
        let bypassPolicy = false;

        const resolvePromise = fetchTvResolveCached(id, adminKey);
        const earlyLitePromise =
          detailsModal &&
          /^\d+$/.test(id) &&
          !/^anime_/i.test(String(id).trim())
            ? fetchTvDetailsCached(id, { lite: true })
            : Promise.resolve(null);

        const [resolved, earlyLiteRaw] = await Promise.all([
          resolvePromise,
          earlyLitePromise,
        ]);
        let earlyLite = earlyLiteRaw;
        const resolvedObj = resolved as {
          playerId?: number | string | null;
          fallback?: Show | null;
          error?: string;
          adminBypass?: boolean;
        } | null;
        if (!resolvedObj) {
          setShow(null);
          setShowUnavailableReason("not_found");
          setLoading(false);
          return;
        }
        if (resolvedObj?.error) {
          setShow(null);
          if (resolvedObj.error === "unauthorized") {
            setShowUnavailableReason("unauthorized");
          } else if (resolvedObj.error === "content_policy" || resolvedObj.error === "not_found") {
            setShowUnavailableReason(resolvedObj.error);
          } else {
            setShowUnavailableReason("not_found");
          }
          setLoading(false);
          return;
        }
        bypassPolicy = resolvedObj?.adminBypass === true;
        if (bypassPolicy) setAdminBypassActive(true);
        const isAnimeCatalogRoute = /^anime_/i.test(String(id).trim());
        if (resolvedObj?.playerId != null && !isAnimeCatalogRoute) {
          targetTmdbId = String(resolvedObj.playerId);
          setResolvedPlayerId(String(resolvedObj.playerId));
        }
        if (
          detailsModal &&
          /^\d+$/.test(targetTmdbId) &&
          targetTmdbId !== id &&
          !isAnimeCatalogRoute &&
          !earlyLite
        ) {
          earlyLite = await fetchTvDetailsCached(targetTmdbId, { lite: true });
        }
        if (resolvedObj?.fallback && typeof resolvedObj.fallback === "object") {
          fallbackShow = resolvedObj.fallback as Show;
        }

        if (detailsModal && fallbackShow?.name) {
          setShow((prev) =>
            mergeModalShow(
              prev,
              fallbackShow.is_anime
                ? finalizeAnimeShowForUi(fallbackShow, id)
                : fallbackShow,
              detailsSeed,
              showToSeedFallback(fallbackShow)
            )
          );
        }

        if (
          detailsModal &&
          earlyLite &&
          /^\d+$/.test(targetTmdbId) &&
          targetTmdbId === id
        ) {
          setShow((prev) =>
            mergeModalShow(prev, earlyLite as Show, detailsSeed, showToSeedFallback(fallbackShow))
          );
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
          const merged = detailsModal
            ? finalizeAnimeShowForUi(fallbackShow, id)
            : await fetchAnilistAndMerge(fallbackShow, fallbackShow, id);
          const withArt = applyAnimeHeroArt(merged, fallbackShow);
          if (
            withArt.is_anime &&
            Array.isArray(fallbackShow.tmdb_playback_seasons) &&
            fallbackShow.tmdb_playback_seasons.length > 0
          ) {
            withArt.tmdb_playback_seasons = fallbackShow.tmdb_playback_seasons;
          }
          const today = catalogTodayYmdUtc();
          if (withArt.seasons?.length && !withArt.is_anime) {
            withArt.seasons = filterReleasedSeasons(withArt.seasons, today) ?? withArt.seasons;
          }
          const withTrailer = await attachAnimeTrailerVideos(withArt);
          setShow((prev) =>
            detailsModal
              ? mergeModalShow(
                  prev,
                  withSeed(withTrailer),
                  detailsSeed,
                  showToSeedFallback(fallbackShow)
                )
              : withSeed(withTrailer)
          );
          pickFirstSeason(withTrailer.seasons);
          setSelectedEpisode(1);
          if (detailsModal) {
            void fetchAnilistAndMerge(fallbackShow, fallbackShow, id).then((enriched) => {
              const upgraded = applyAnimeHeroArt(
                finalizeAnimeShowForUi(enriched, id),
                fallbackShow
              );
              setShow((prev) =>
                mergeModalShow(
                  prev,
                  withSeed(upgraded),
                  detailsSeed,
                  showToSeedFallback(fallbackShow)
                )
              );
            });
          }
          return;
        }

        const detailsData = detailsModal
          ? ((earlyLite && targetTmdbId === id
              ? earlyLite
              : await fetchTvDetailsCached(targetTmdbId, { lite: true })) as Show | null)
          : await fetchTvDetailsCached(targetTmdbId);

        if (!detailsData) {
          if (fallbackShow) {
            const merged = detailsModal
            ? finalizeAnimeShowForUi(fallbackShow, id)
            : await fetchAnilistAndMerge(fallbackShow, fallbackShow, id);
            const withArt = applyAnimeHeroArt(merged, fallbackShow);
            const today = catalogTodayYmdUtc();
            if (withArt.seasons?.length && !withArt.is_anime) {
              withArt.seasons = filterReleasedSeasons(withArt.seasons, today) ?? withArt.seasons;
            }
            const withTrailer = await attachAnimeTrailerVideos(withArt);
            setShow((prev) =>
              detailsModal
                ? mergeModalShow(
                    prev,
                    withSeed(withTrailer),
                    detailsSeed,
                    showToSeedFallback(fallbackShow)
                  )
                : withSeed(withTrailer)
            );
            pickFirstSeason(withTrailer.seasons);
            setSelectedEpisode(1);
            return;
          }
          throw new Error("Failed to fetch show details");
        }
        const data = detailsData as Show;
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
        if (
          !bypassPolicy &&
          (isBlockedAdultAnimeDoc(blockedDoc) ||
            isBlockedAdultTmdbTvShow(data as unknown as Record<string, unknown>))
        ) {
          setShow(null);
          setShowUnavailableReason("content_policy");
          setLoading(false);
          return;
        }
        const todayYmd = catalogTodayYmdUtc();
        if (!data.is_anime && Array.isArray(data.seasons) && data.seasons.length) {
          const rel = filterReleasedSeasons(data.seasons as Season[], todayYmd);
          if (rel?.length) data.seasons = rel as Show["seasons"];
        }
        if (fallbackShow?.is_anime) {
          data.is_anime = true;
          const withArt = applyAnimeHeroArt(data, fallbackShow);
          data.poster_path = withArt.poster_path;
          data.backdrop_path = withArt.backdrop_path;
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
        const mergedBase = detailsModal
          ? forAni.is_anime || fallbackShow?.is_anime
            ? finalizeAnimeShowForUi(forAni, id)
            : forAni
          : await fetchAnilistAndMerge(forAni, fallbackShow, id);
        const merged = applyAnimeHeroArt(mergedBase, fallbackShow);
        if (merged.seasons?.length && !merged.is_anime) {
          merged.seasons = filterReleasedSeasons(merged.seasons, todayYmd) ?? merged.seasons;
        }
        if (tmdbSeasonsPlayback?.length && data.is_anime) {
          merged.tmdb_playback_seasons = tmdbSeasonsPlayback;
        }
        const finalShow = detailsModal
          ? merged
          : await attachAnimeTrailerVideos(merged);
        setShow((prev) =>
          mergeModalShow(prev, withSeed(finalShow), detailsSeed, showToSeedFallback(fallbackShow))
        );
        pickFirstSeason(finalShow.seasons);
        setSelectedEpisode(1);

        if (detailsModal) {
          if (merged.is_anime || fallbackShow?.is_anime) {
            void fetchAnilistAndMerge(forAni, fallbackShow, id).then((enriched) => {
            const upgraded = applyAnimeHeroArt(
              finalizeAnimeShowForUi(enriched, id),
              fallbackShow
            );
            setShow((prev) =>
              mergeModalShow(
                prev,
                withSeed(upgraded),
                detailsSeed,
                showToSeedFallback(fallbackShow)
              )
            );
          });
          }

          if (/^\d+$/.test(targetTmdbId)) {
            void (async () => {
            const full = await fetchTvDetailsCached(targetTmdbId);
            if (!full) return;
            const fullData = full as Show;
            if (
              !bypassPolicy &&
              (isBlockedAdultAnimeDoc(blockedDoc) ||
                isBlockedAdultTmdbTvShow(fullData as unknown as Record<string, unknown>))
            ) {
              return;
            }
            if (fallbackShow?.is_anime) fullData.is_anime = true;
            if (!fullData.is_anime && Array.isArray(fullData.seasons) && fullData.seasons.length) {
              const rel = filterReleasedSeasons(fullData.seasons as Season[], todayYmd);
              if (rel?.length) fullData.seasons = rel as Show["seasons"];
            }
            const forAniFull: Show = {
              ...fullData,
              anilist_id: fullData.anilist_id ?? catalogAnilistId(fallbackShow) ?? undefined,
              mal_id: fullData.mal_id ?? fallbackShow?.mal_id ?? undefined,
              external_ids: fullData.external_ids ?? fallbackShow?.external_ids ?? undefined,
            };
            const mergedFullBase = detailsModal
              ? forAniFull.is_anime || fallbackShow?.is_anime
                ? finalizeAnimeShowForUi(forAniFull, id)
                : forAniFull
              : await fetchAnilistAndMerge(forAniFull, fallbackShow, id);
            const mergedFull = applyAnimeHeroArt(mergedFullBase, fallbackShow);
            const withTrailer = await attachAnimeTrailerVideos(mergedFull);
            setShow((prev) =>
              mergeModalShow(
                prev,
                withSeed(withTrailer),
                detailsSeed,
                showToSeedFallback(fallbackShow)
              )
            );
          })();
          }
          return;
        }
      } catch {
        /* keep prior show on transient errors */
      } finally {
        setLoading(false);
      }
    };
    fetchShowDetails();
  }, [id, adminKey, detailsModal, detailsSeed]);

  // Anime films (AniList format MOVIE/MUSIC) have no TMDB tv id; resolve a TMDB movie id so they
  // play through the standard movie embed instead of the legacy AniList /anime path.
  useEffect(() => {
    if (detailsModal || !show || loading) {
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
  }, [show, loading, id, detailsModal]);

  useEffect(() => {
    setFetchedBannerUrl(null);
    if (loading || !show || viewMode !== "details" || detailsModal) return;
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
        if (banner) setFetchedBannerUrl(catalogHeroImageUrl(banner) || banner);
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
    if (viewMode === "episodes") {
      document.title = year
        ? `${displayName} (${year}) Episodes - Teavie`
        : `${displayName} Episodes - Teavie`;
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
  const episodesHref = buildShowEpisodesHref(id);

  const navigateToEpisode = useCallback(
    (season: number, episode: number) => {
      router.push(
        buildShowWatchHref(id, {
          season,
          episode,
          party: partyRoomId,
        })
      );
    },
    [id, partyRoomId, router]
  );

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

  useEffect(() => {
    if (viewMode !== "watch") return;
    if (isAnimeMovie) {
      recordMovieInWatchHistory(String(id));
      return;
    }
    if (!show) return;
    const coords = show.is_anime
      ? resolveAnimePlayerCoords(show, selectedSeason, selectedEpisode)
      : { season: selectedSeason, episode: selectedEpisode };
    touchWatchHistory(String(id), {
      mediaType: "tv",
      lastSeason: coords.season,
      lastEpisode: coords.episode,
    });
  }, [
    viewMode,
    id,
    show,
    isAnimeMovie,
    selectedSeason,
    selectedEpisode,
  ]);

  const handleVidrockProgress = useCallback(
    (progress: { seconds: number; season: number; episode: number }) => {
      const s = progress.season || selectedSeason;
      const e = progress.episode || selectedEpisode;
      const sec = Math.floor(Number(progress.seconds) || 0);
      if (isAnimeMovie) {
        recordMovieInWatchHistory(String(id));
        if (sec >= 1) saveMoviePlaybackPosition(String(id), sec);
        watchParty.noteHostPlayback(sec);
        return;
      }
      touchWatchHistory(String(id), {
        mediaType: "tv",
        lastSeason: s,
        lastEpisode: e,
      });
      if (sec >= 1) {
        markEpisodeWatchedFromPlayback(s, e, sec);
        saveEpisodePlaybackPosition(String(id), s, e, sec);
      }
      watchParty.noteHostPlayback(sec);
    },
    [
      id,
      isAnimeMovie,
      selectedSeason,
      selectedEpisode,
      watchParty,
      markEpisodeWatchedFromPlayback,
    ]
  );

  const handlePlayerReady = useCallback(() => {
    if (isAnimeMovie) {
      recordMovieInWatchHistory(String(id));
      return;
    }
    touchWatchHistory(String(id), {
      mediaType: "tv",
      lastSeason: selectedSeason,
      lastEpisode: selectedEpisode,
    });
  }, [id, isAnimeMovie, selectedSeason, selectedEpisode]);

  const handleStremioProgress = useCallback(
    (seconds: number) => {
      const s = selectedSeason;
      const e = selectedEpisode;
      const sec = Math.floor(Number(seconds) || 0);
      markEpisodeWatchedFromPlayback(s, e, sec);
      saveEpisodePlaybackPosition(String(id), s, e, sec);
      watchParty.noteHostPlayback(sec);
      if (!watchParty.isHost || !watchParty.room || server !== "stremio") return;
      const now = Date.now();
      if (now - partyPlaybackBroadcastRef.current < PARTY_HOST_BROADCAST_MS) return;
      partyPlaybackBroadcastRef.current = now;
      void watchParty.broadcastPlayback(sec);
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
  const showToolbar = show ? (
    <div className="flex flex-wrap items-center gap-2">
      {viewMode === "details" && (canPlay || isAnimeMovie) ? (
        isAnimeMovie ? (
          <Button
            as={Link}
            href={watchHref}
            color="success"
            size="lg"
            radius="full"
            className="border border-white/25 !bg-[#22c55e]/90 !text-[#052e16] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_8px_24px_rgba(34,197,94,0.16)] backdrop-blur-xl hover:!bg-[#2dd66b]"
            startContent={<AssetMaskIcon src="/rail-icons/play.svg" size={20} />}
            onPress={onDetailsNavigate}
          >
            Play
          </Button>
        ) : canPlay ? (
          <Button
            as={Link}
            href={episodesHref}
            color="success"
            size="lg"
            radius="full"
            className="border border-white/25 !bg-[#22c55e]/90 !text-[#052e16] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_8px_24px_rgba(34,197,94,0.16)] backdrop-blur-xl hover:!bg-[#2dd66b]"
            startContent={<AssetMaskIcon src="/rail-icons/tv-retro.svg" size={20} />}
            onPress={onDetailsNavigate}
          >
            Episodes
          </Button>
        ) : null
      ) : null}
      <FavoriteButton catalogId={String(id)} mediaType="tv" size="lg" radius="full" className="border border-white/15 bg-default-100/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl dark:!bg-white/10" iconOnly />
      <WatchLaterButton catalogId={String(id)} mediaType="tv" size="lg" radius="full" className="border border-white/15 bg-default-100/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl dark:!bg-white/10" iconOnly />
    </div>
  ) : null;
  
  const showGenresForDisplay = show
    ? catalogGenresForDisplay({ imdb_genres: show.imdb_genres, omdb: show.omdb, genres: show.genres })
    : [];
  
  const showTitleOverlay = show && detailsModal ? (
    <CatalogTitleBlock
      title={title}
      logoPath={titleLogoPath}
      rating={Number.isFinite(Number(show.vote_average)) ? Number(show.vote_average) : null}
      certification={usCertificationFromDoc(show)}
      status={show.status}
      mediaType="tv"
      genres={showGenresForDisplay}
      genreBrowseBase={isKdramaShow(show) ? "/kdrama/all" : undefined}
      statPills={buildShowDetailStatPills(show, isAnimeShowPage(show, id))}
      alternateTitles={buildShowAlternateTitles(show)}
      toolbar={showToolbar}
    />
  ) : null;

  const showDetailsPanel = (
    <div className="w-full">
      {show && (
        <CatalogMediaPanel
            posterUrl={imageUrl}
            posterAlt={title}
            title={title}
            logoPath={titleLogoPath}
            hidePosterOnDesktop={detailsModal}
            hideTitleBlockOnDesktop={detailsModal}
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
                {viewMode === "details" && (canPlay || isAnimeMovie) ? (
                  isAnimeMovie ? (
                    <Button
                      as={Link}
                      href={watchHref}
                      color="success"
                      size="lg"
                      radius="full"
                      className="border border-white/25 !bg-[#22c55e]/90 !text-[#052e16] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_8px_24px_rgba(34,197,94,0.16)] backdrop-blur-xl hover:!bg-[#2dd66b]"
                      startContent={
                        <AssetMaskIcon
                          src="/rail-icons/play.svg"
                          size={20}
                        />
                      }
                      onPress={onDetailsNavigate}
                    >
                      Play
                    </Button>
                  ) : canPlay ? (
                    <Button
                      as={Link}
                      href={episodesHref}
                      color="success"
                      size="lg"
                      radius="full"
                      className="border border-white/25 !bg-[#22c55e]/90 !text-[#052e16] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_8px_24px_rgba(34,197,94,0.16)] backdrop-blur-xl hover:!bg-[#2dd66b]"
                      startContent={
                        <AssetMaskIcon
                          src="/rail-icons/tv-retro.svg"
                          size={20}
                        />
                      }
                      onPress={onDetailsNavigate}
                    >
                      Episodes
                    </Button>
                  ) : null
                ) : null}
                <FavoriteButton
                  catalogId={String(id)}
                  mediaType="tv"
                  size="lg"
                  radius="full"
                  className="border border-white/15 bg-default-100/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl dark:!bg-white/10"
                  iconOnly
                />
                <WatchLaterButton
                  catalogId={String(id)}
                  mediaType="tv"
                  size="lg"
                  radius="full"
                  className="border border-white/15 bg-default-100/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl dark:!bg-white/10"
                  iconOnly
                />
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

  const showRelatedSections = detailsModal ? (
    <DeferredModalSections>
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
    </DeferredModalSections>
  ) : (
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

  if (loading && !(detailsModal && show)) {
    const seedBanner =
      detailsModal && detailsSeed
        ? catalogHeroImageUrl(seedBannerPath(detailsSeed) ?? "")
        : null;
    return viewMode === "details" ? (
      <CatalogDetailsSkeleton modal={detailsModal} bannerUrl={seedBanner} />
    ) : (
      <WatchPageSkeleton withSeasonPicker />
    );
  }

  if (!show) {
    const unavailableBanner =
      detailsModal && detailsSeed
        ? catalogHeroImageUrl(seedBannerPath(detailsSeed) ?? "")
        : null;
    return (
      <CatalogUnavailable
        reason={
          showUnavailableReason === "content_policy"
            ? "content_policy"
            : showUnavailableReason === "unauthorized"
              ? "unauthorized"
              : "not_found"
        }
        variant={detailsModal ? "modal" : "page"}
        backdropUrl={unavailableBanner}
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
          !streamHydrated ? (
            <PlayerEmbedSkeleton rounded="rounded-xl" />
          ) : (
          <MoviePlayer
            key={`movie-${id}`}
            videoId={animeMovieTmdbId}
            imdbId={catalogImdbId(show)}
            title={title}
            posterUrl={imageUrl}
            backdropUrl={resolveShowDetailsBannerUrl(show, id, imageUrl, fetchedBannerUrl)}
            server={server}
            onVidrockProgress={server === "vidrock" ? handleVidrockProgress : undefined}
            onEmbedLoad={handlePlayerReady}
          />
          )
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
      ) : !streamHydrated ? (
        <PlayerEmbedSkeleton rounded="rounded-xl" />
      ) : (
        <ShowPlayer
          key={`${id}-${playerCoords.season}-${playerCoords.episode}-${playerEpoch}`}
          server={server}
          videoId={resolvedPlayerId}
          imdbId={catalogImdbId(show)}
          title={title}
          posterUrl={imageUrl}
          backdropUrl={resolveShowDetailsBannerUrl(show, id, imageUrl, fetchedBannerUrl)}
          season={playerCoords.season}
          episode={playerCoords.episode}
          startSeconds={server === "stremio" ? playerStartSeconds : 0}
          onStremioProgress={server === "stremio" ? handleStremioProgress : undefined}
          onVidrockProgress={server === "vidrock" ? handleVidrockProgress : undefined}
          onEmbedLoad={() => {
            handlePlayerReady();
            if (server === "vidcore") {
              markEpisodeWatched(playerCoords.season, playerCoords.episode);
            }
          }}
        />
      )}
    </div>
  );

  if (viewMode === "episodes") {
    const year = show.first_air_date?.slice(0, 4);
    const backdropUrl = resolveShowDetailsBannerUrl(
      show,
      id,
      imageUrl,
      fetchedBannerUrl
    );

    return (
      <ShowEpisodesView
        title={title}
        logoPath={titleLogoPath}
        year={year}
        certification={usCertificationFromDoc(show)}
        overview={show.overview}
        backdropUrl={backdropUrl}
        isAnimeMovie={isAnimeMovie}
        watchHref={watchHref}
        episodePickerProps={episodePickerProps}
        onNavigateToEpisode={navigateToEpisode}
      />
    );
  }

  if (viewMode === "details") {
    const isAnimeDetails = isAnimeShowPage(show, id);
    const detailsBannerUrl = detailsModal
      ? resolveFrozenModalHeroBanner(modalHeroBannerRef, {
          mediaType: "show",
          catalogId: id,
          seed: detailsSeed,
          resolveFromDoc: () =>
            resolveShowDetailsBannerUrl(show, id, imageUrl, null),
        })
      : resolveShowDetailsBannerUrl(show, id, imageUrl, fetchedBannerUrl);
    const hasDetailsHero = Boolean(detailsBannerUrl);
    const heroAccentColor = isAnimeDetails ? animeAccentColor : null;

    return (
      <ShowDetailsView
        detailsModal={detailsModal}
        adminPreview={adminPreview}
        adminBypassActive={adminBypassActive}
        hasDetailsHero={hasDetailsHero}
        detailsBannerUrl={detailsBannerUrl}
        heroAccentColor={heroAccentColor}
        title={title}
        titleOverlay={showTitleOverlay}
        detailsPanel={showDetailsPanel}
        trailerEmbedUrl={trailerEmbedUrl}
        canPlay={canPlay}
        tmdbShowPremiered={Boolean(tmdbShowPremiered)}
        relatedSections={showRelatedSections}
      />
    );
  }

  return (
    <ShowWatchView
      adminPreview={adminPreview}
      adminBypassActive={adminBypassActive}
      isAnimeMovie={isAnimeMovie}
      title={title}
      playerBlock={playerBlock}
      episodePickerProps={episodePickerProps}
    />
  );
}
