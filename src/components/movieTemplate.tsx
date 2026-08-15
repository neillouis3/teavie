'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@heroui/react';
import AssetMaskIcon from '@/components/ui/assetMaskIcon';
import MoviePlayer from './moviePlayer';
import YouMightLike from './youMightLike';
import MovieCollectionRail from '@/components/movie/MovieCollectionRail';

import {
  loadMoviePlaybackPosition,
  saveMoviePlaybackPosition,
} from '@/lib/movieWatchProgress';
import {
  buildMovieInfoLines,
  catalogGenresForDisplay,
  type CatalogDetailLink,
} from './ui/catalogDetailColumns';
import CatalogMediaPanel, { CatalogTitleBlock } from './ui/catalogMediaPanel';
import { ImmersiveWatchPageSkeleton } from '@/components/ui/watchPageSkeleton';
import CatalogDetailsSkeleton from '@/components/ui/catalogDetailsSkeleton';
import CatalogComingSoon from './ui/catalogComingSoon';
import ImmersiveWatchBackChrome from '@/components/ui/immersiveWatchBackChrome';
import DeferredModalSections from '@/components/ui/deferredModalSections';
import { useStreamingSource, type StreamServerId } from '@/contexts/streamingSourceContext';
import { recordMovieInWatchHistory } from '@/lib/watchHistory';
import { usCertificationFromDoc } from '@/lib/mapContentDocToItem';
import { tmdbImageUrl } from '@/lib/tmdbImage';
import { isBlockedMovieTmdbId } from '@/lib/tmdbMovieContentPolicy';
import CatalogUnavailable from './ui/catalogUnavailable';
import WatchLaterButton from '@/components/watchLater/WatchLaterButton';
import FavoriteButton from '@/components/favorites/FavoriteButton';
import MovieCreditsStrip from '@/components/movie/MovieCreditsStrip';
import MovieTrailerEmbed from '@/components/movie/MovieTrailerEmbed';
import ShowDetailsHero, {
  SHOW_DETAILS_HERO_OVERLAP,
} from '@/components/show/ShowDetailsHero';
import { pickYoutubeTrailerEmbedUrl, type TmdbVideosPayload } from '@/lib/tmdbVideos';
import { MOVIE_CONTENT_INSET_X } from '@/lib/contentInset';
import { DETAIL_CONTENT_STACK_CLASS } from '@/lib/catalogGrid';
import { useTmdbTitleLogo } from '@/hooks/useTmdbTitleLogo';
import {
  type CatalogDetailsSeed,
  type CatalogSeedFallback,
  mergeModalMovie,
  preserveSeedBackdrop,
  seedBannerPath,
} from '@/lib/catalogDetailsSeed';
import {
  fetchMovieDetailsCached,
  fetchMovieResolveCached,
} from '@/lib/catalogDetailsPrefetch';
import { resolveFrozenModalHeroBanner } from '@/lib/catalogModalHeroBanner';

interface Movie {
  id: number;
  title: string;
  /** TMDB original title (often non-English). */
  original_title?: string;
  release_date: string;
  status: string;
  runtime?: number;
  runtimeSeconds?: number;
  overview: string;
  /** ISO 639-1 (e.g. `ja`, `en`). */
  original_language?: string;
  /** ISO 3166-1 alpha-2 codes (often co-productions); prefer {@link production_countries} for display. */
  origin_country?: string[];
  /** TMDB production countries — best match for “country of origin” copy. */
  production_countries?: { iso_3166_1?: string; name?: string }[];
  production_companies?: { id?: number; name?: string }[];
  genres: { id: number; name: string }[];
  imdb_genres?: string[];
  omdb?: { genre?: string | null };
  poster_path: string;
  backdrop_path?: string | null;
  vote_average: number;
  tagline: string;
  homepage?: string | null;
  imdb_id?: string | null;
  release_dates?: unknown;
  credits?: unknown;
  videos?: TmdbVideosPayload;
}

export type MovieServerKey = StreamServerId;
export type MovieTemplateViewMode = 'details' | 'watch';

function isReleasedByDate(releaseDate: string | undefined | null): boolean {
  const d = String(releaseDate ?? '').trim();
  if (d.length < 10) return true;
  const ymd = d.slice(0, 10);
  return ymd <= new Date().toISOString().slice(0, 10);
}



function movieDetailLinks(movie: Movie): CatalogDetailLink[] {
  const links: CatalogDetailLink[] = [];
  if (movie.imdb_id && /^tt\d+/i.test(movie.imdb_id)) {
    links.push({
      href: `https://www.imdb.com/title/${movie.imdb_id}/`,
      label: 'IMDb',
    });
  }
  const homepage = String(movie.homepage ?? '').trim();
  if (homepage) {
    links.push({ href: homepage, label: 'Official site' });
  }
  return links;
}

function buildMovieWatchHref(catalogId: string): string {
  return `/movies/${encodeURIComponent(catalogId)}/watch`;
}

function resolveMovieDetailsBannerUrl(movie: Movie): string | null {
  const backdrop = tmdbImageUrl(movie.backdrop_path);
  if (backdrop) return backdrop;
  return tmdbImageUrl(movie.poster_path) || null;
}

function movieFromSeed(id: string, seed: CatalogDetailsSeed): Movie {
  const releaseDate = seed.releaseDate?.slice(0, 10) ?? '';
  const placeholderYearOnly =
    /^\d{4}-01-01$/.test(releaseDate) ? releaseDate.slice(0, 4) : releaseDate;
  return {
    id: Number(id) || 0,
    title: seed.title,
    release_date: placeholderYearOnly,
    status: 'Released',
    overview: seed.overview ?? '',
    poster_path: seed.posterPath ?? '',
    backdrop_path: seed.backdropPath ?? seed.posterPath ?? null,
    vote_average: seed.voteAverage ?? 0,
    tagline: '',
    genres: [],
  };
}

type CatalogMovieFallback = CatalogSeedFallback & {
  id?: string | number;
  title?: string;
  release_date?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  status?: string;
  imdb_genres?: string[];
  omdb?: { genre?: string | null };
  original_language?: string | null;
};

function movieFromCatalogFallback(
  tmdbId: string,
  fallback: CatalogMovieFallback,
  seed: CatalogDetailsSeed | null
): Movie {
  return mergeModalMovie(null, {
    id: Number(tmdbId) || 0,
    title: fallback.title ?? seed?.title ?? '',
    release_date: fallback.release_date ?? seed?.releaseDate?.slice(0, 10) ?? '',
    status: 'Released',
    overview: fallback.overview ?? seed?.overview ?? '',
    poster_path: fallback.poster_path ?? seed?.posterPath ?? '',
    backdrop_path:
      fallback.backdrop_path ?? seed?.backdropPath ?? seed?.posterPath ?? null,
    vote_average: fallback.vote_average ?? seed?.voteAverage ?? 0,
    tagline: '',
    genres: [],
    imdb_genres: fallback.imdb_genres,
    omdb: fallback.omdb,
  }, seed, fallback);
}



export default function MovieTemplate({
  id,
  viewMode = 'details',
  detailsModal = false,
  detailsSeed = null,
  onDetailsNavigate,
}: {
  id: string;
  viewMode?: MovieTemplateViewMode;
  detailsModal?: boolean;
  detailsSeed?: CatalogDetailsSeed | null;
  onDetailsNavigate?: () => void;
}) {
  const { server, hydrated: streamHydrated } = useStreamingSource();
  const [movie, setMovie] = useState<Movie | null>(() =>
    detailsModal && detailsSeed ? movieFromSeed(id, detailsSeed) : null
  );
  const [resolvedTmdbId, setResolvedTmdbId] = useState<string>(id);
  const [loading, setLoading] = useState(() => !(detailsModal && detailsSeed));
  const [movieUnavailableReason, setMovieUnavailableReason] = useState<
    'content_policy' | 'not_found' | null
  >(null);
  const [playerStartSeconds, setPlayerStartSeconds] = useState(0);
  const [playerEpoch, setPlayerEpoch] = useState(0);
  const modalHeroBannerRef = useRef<string | null>(null);
  const titleLogoPath = useTmdbTitleLogo(
    "movie",
    detailsModal ? null : id
  );

  const watchHref = buildMovieWatchHref(id);

  const movieReleased = movie ? isReleasedByDate(movie.release_date) : false;

  useEffect(() => {
    if (viewMode !== 'watch') return;
    setPlayerStartSeconds(loadMoviePlaybackPosition(String(id)));
    setPlayerEpoch((n) => n + 1);
  }, [id, viewMode]);

  useEffect(() => {
    if (viewMode !== 'watch') return;
    recordMovieInWatchHistory(String(id));
  }, [viewMode, id]);

  const handleStremioProgress = useCallback(
    (seconds: number) => {
      const sec = Math.floor(Number(seconds) || 0);
      if (sec >= 1) {
        recordMovieInWatchHistory(String(id));
        saveMoviePlaybackPosition(String(id), sec);
      }
    },
    [id]
  );

  const handleVidrockProgress = useCallback(
    (progress: { seconds: number }) => {
      recordMovieInWatchHistory(String(id));
      const sec = Math.floor(Number(progress.seconds) || 0);
      if (sec >= 1) handleStremioProgress(sec);
    },
    [id, handleStremioProgress]
  );

  const handlePlayerReady = useCallback(() => {
    recordMovieInWatchHistory(String(id));
  }, [id]);

  useEffect(() => {
    modalHeroBannerRef.current = null;
  }, [id, detailsModal]);

  useEffect(() => {
    if (!detailsModal) return;
    if (detailsSeed) {
      setMovie(movieFromSeed(id, detailsSeed));
    } else {
      setMovie(null);
    }
  }, [id, detailsModal, detailsSeed]);

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        setMovieUnavailableReason(null);
        if (detailsModal && detailsSeed) {
          setMovie((current) => current ?? movieFromSeed(id, detailsSeed));
        } else {
          setLoading(true);
          setMovie(null);
        }

        if (isBlockedMovieTmdbId(id)) {
          setMovie(null);
          setMovieUnavailableReason('content_policy');
          return;
        }

        const resolvePromise = fetchMovieResolveCached(id);
        const earlyLitePromise =
          detailsModal && /^\d+$/.test(id)
            ? fetchMovieDetailsCached(id, { lite: true })
            : Promise.resolve(null);

        const [resolveRes, earlyLite] = await Promise.all([
          resolvePromise,
          earlyLitePromise,
        ]);
        if (!resolveRes) {
          if (!(detailsModal && detailsSeed)) setMovie(null);
          setMovieUnavailableReason('not_found');
          return;
        }

        const resolved = resolveRes as {
          playerId?: number | string | null;
          fallback?: Record<string, unknown> | null;
          error?: string;
        };

        if (resolved?.error === 'content_policy') {
          setMovie(null);
          setMovieUnavailableReason('content_policy');
          return;
        }

        if (resolved?.error) {
          setMovie(null);
          setMovieUnavailableReason('not_found');
          return;
        }

        const catalogFallback: CatalogMovieFallback | null =
          resolved?.fallback && typeof resolved.fallback === 'object'
            ? (resolved.fallback as CatalogMovieFallback)
            : null;

        let tmdbId = id;
        if (resolved?.playerId != null) {
          tmdbId = String(resolved.playerId);
        }
        setResolvedTmdbId(tmdbId);

        const applyCatalogFallback = (data: Movie): Movie => {
          if (catalogFallback?.imdb_genres?.length) {
            data.imdb_genres = catalogFallback.imdb_genres;
          }
          if (catalogFallback?.omdb) {
            data.omdb = catalogFallback.omdb;
          }
          if (!data.backdrop_path && catalogFallback?.backdrop_path) {
            data.backdrop_path = catalogFallback.backdrop_path;
          }
          if (!data.overview?.trim() && catalogFallback?.overview?.trim()) {
            data.overview = catalogFallback.overview;
          }
          if (!data.release_date?.trim() && catalogFallback?.release_date?.trim()) {
            data.release_date = catalogFallback.release_date;
          }
          return data;
        };

        const applyModalMovie = (data: Movie) => {
          setMovie((prev) =>
            mergeModalMovie(
              prev,
              applyCatalogFallback(data),
              detailsSeed,
              catalogFallback
            )
          );
        };

        if (detailsModal && earlyLite && /^\d+$/.test(tmdbId) && tmdbId === id) {
          applyModalMovie(earlyLite as Movie);
        }

        if (detailsModal && catalogFallback?.title) {
          applyModalMovie(movieFromCatalogFallback(tmdbId, catalogFallback, detailsSeed));
        }

        if (!/^\d+$/.test(tmdbId)) {
          if (catalogFallback?.title) {
            const fallbackMovie: Movie = {
              id: Number(catalogFallback.id) || 0,
              title: catalogFallback.title,
              release_date: catalogFallback.release_date ?? '',
              status: catalogFallback.status ?? 'Released',
              overview: catalogFallback.overview ?? '',
              poster_path: catalogFallback.poster_path ?? '',
              backdrop_path: catalogFallback.backdrop_path ?? null,
              vote_average: catalogFallback.vote_average ?? 0,
              tagline: '',
              genres: [],
              imdb_genres: catalogFallback.imdb_genres,
              omdb: catalogFallback.omdb,
              original_language: catalogFallback.original_language ?? undefined,
            };
            if (detailsModal) {
              applyModalMovie(fallbackMovie);
            } else {
              setMovie(fallbackMovie);
            }
            return;
          }
          setMovie(null);
          setMovieUnavailableReason('not_found');
          return;
        }

        if (detailsModal) {
          const lite =
            earlyLite && /^\d+$/.test(tmdbId) && tmdbId === id
              ? earlyLite
              : await fetchMovieDetailsCached(tmdbId, { lite: true });
          if (lite) applyModalMovie(lite as Movie);

          void fetchMovieDetailsCached(tmdbId).then((full) => {
            if (full) applyModalMovie(full as Movie);
          });
          return;
        }

        const detailsData = await fetchMovieDetailsCached(tmdbId);

        if (!detailsData) {
          if (catalogFallback?.title) {
            setMovie({
              id: Number(tmdbId) || 0,
              title: catalogFallback.title,
              release_date: catalogFallback.release_date ?? '',
              status: catalogFallback.status ?? 'Released',
              overview: catalogFallback.overview ?? '',
              poster_path: catalogFallback.poster_path ?? '',
              backdrop_path: catalogFallback.backdrop_path ?? null,
              vote_average: catalogFallback.vote_average ?? 0,
              tagline: '',
              genres: [],
              imdb_genres: catalogFallback.imdb_genres,
              omdb: catalogFallback.omdb,
              original_language: catalogFallback.original_language ?? undefined,
            });
            return;
          }
          throw new Error('Failed to fetch movie details');
        }

        const data = detailsData as Movie;
        setMovie(
          preserveSeedBackdrop(
            applyCatalogFallback(data),
            detailsModal ? detailsSeed : null
          )
        );
      } catch (err) {
        console.error('Error fetching movie details:', err);
        if (!(detailsModal && detailsSeed)) {
          setMovie(null);
        }
        setMovieUnavailableReason('not_found');
      } finally {
        setLoading(false);
      }
    };

    fetchMovieDetails();
  }, [id, detailsModal, detailsSeed]);

  useEffect(() => {
    if (!movie?.title) return;
    const year = movie.release_date?.slice(0, 4);
    if (viewMode === 'details') {
      document.title = year
        ? `${movie.title} (${year}) - Teavie`
        : `${movie.title} - Teavie`;
      return;
    }
    document.title = year
      ? `Watch ${movie.title} (${year}) - Teavie`
      : `Watch ${movie.title} - Teavie`;
  }, [movie, viewMode]);

  const imageUrl = tmdbImageUrl(movie?.poster_path);
  const trailerEmbedUrl = movie
    ? pickYoutubeTrailerEmbedUrl(movie.videos)
    : null;

  if (loading && !(detailsModal && movie)) {
    const seedBanner =
      detailsModal && detailsSeed
        ? tmdbImageUrl(seedBannerPath(detailsSeed) ?? "")
        : null;
    return viewMode === 'details' ? (
      <CatalogDetailsSkeleton modal={detailsModal} bannerUrl={seedBanner} />
    ) : (
      <ImmersiveWatchPageSkeleton />
    );
  }

  if (!movie) {
    const unavailableBanner =
      detailsModal && detailsSeed
        ? tmdbImageUrl(seedBannerPath(detailsSeed) ?? "")
        : null;
    const unavailable = (
      <CatalogUnavailable
        reason={
          movieUnavailableReason === 'content_policy'
            ? 'content_policy'
            : 'not_found'
        }
        variant={detailsModal ? 'modal' : 'page'}
        backdropUrl={unavailableBanner}
      />
    );
    if (viewMode === 'watch' && !detailsModal) {
      return (
        <div className="fixed inset-0 z-0 flex h-[100dvh] w-full items-center justify-center bg-black px-6">
          <ImmersiveWatchBackChrome />
          {unavailable}
        </div>
      );
    }
    return unavailable;
  }

  const movieToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {viewMode === 'details' && movieReleased ? (
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
      ) : null}
      <FavoriteButton catalogId={String(id)} mediaType="movie" size="lg" radius="full" className="border border-white/15 bg-default-100/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl dark:!bg-white/10" iconOnly />
      <WatchLaterButton catalogId={String(id)} mediaType="movie" size="lg" radius="full" className="border border-white/15 bg-default-100/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl dark:!bg-white/10" iconOnly />
    </div>
  );
  
  const movieGenresForDisplay = catalogGenresForDisplay({
    imdb_genres: movie.imdb_genres,
    omdb: movie.omdb,
    genres: movie.genres,
  });
  
  const movieTitleOverlay = detailsModal ? (
    <CatalogTitleBlock
      title={movie.title}
      logoPath={titleLogoPath}
      rating={movie.vote_average}
      certification={usCertificationFromDoc(movie)}
      status={movie.status}
      mediaType="movie"
      genres={movieGenresForDisplay}
      toolbar={movieToolbar}
    />
  ) : null;
  
  const movieDetailsPanel = (
    <div className="w-full">
      <CatalogMediaPanel
        posterUrl={imageUrl}
        posterAlt={movie.title}
        title={movie.title}
        logoPath={titleLogoPath}
        hidePosterOnDesktop={detailsModal}
        hideTitleBlockOnDesktop={detailsModal}
        rating={movie.vote_average}
        certification={usCertificationFromDoc(movie)}
        status={movie.status}
        overview={movie.overview}
        tagline={movie.tagline}
        mediaType="movie"
        genres={movieGenresForDisplay}
        infoLines={buildMovieInfoLines(movie)}
        links={movieDetailLinks(movie)}
        toolbar={movieToolbar}
        creditsSection={<MovieCreditsStrip credits={movie.credits} />}
      />
    </div>
  );



  if (viewMode === 'details') {
    const detailsBannerUrl = detailsModal
      ? resolveFrozenModalHeroBanner(modalHeroBannerRef, {
          mediaType: 'movie',
          catalogId: id,
          seed: detailsSeed,
          resolveFromDoc: () => resolveMovieDetailsBannerUrl(movie),
        })
      : resolveMovieDetailsBannerUrl(movie);
    const hasDetailsHero = Boolean(detailsBannerUrl);

    return (
      <div
        className={`flex w-full flex-col overflow-x-hidden pb-32 ${
          detailsModal ? "bg-transparent" : "bg-background"
        }`}
      >
        {hasDetailsHero ? (
          <ShowDetailsHero
            bannerUrl={detailsBannerUrl!}
            title={movie.title}
            overlayContent={movieTitleOverlay}
          />
        ) : null}
        <div
          className={`relative z-10 ${DETAIL_CONTENT_STACK_CLASS} ${MOVIE_CONTENT_INSET_X} ${
            hasDetailsHero
              ? SHOW_DETAILS_HERO_OVERLAP
              : 'bg-background/92 dark:bg-background/88'
          }`}
        >
          {movieDetailsPanel}
          {trailerEmbedUrl ? (
            <MovieTrailerEmbed
              variant="details"
              src={trailerEmbedUrl}
              title={`${movie.title} trailer`}
            />
          ) : null}
          {detailsModal ? (
            <DeferredModalSections>
              {/^\d+$/.test(String(resolvedTmdbId)) ? (
                <MovieCollectionRail
                  key={`collection-${resolvedTmdbId}`}
                  movieId={String(resolvedTmdbId)}
                  bleed={false}
                />
              ) : null}
              {/^\d+$/.test(String(resolvedTmdbId)) ? (
                <YouMightLike
                  key={`yml-${resolvedTmdbId}`}
                  mediaType="movie"
                  id={String(resolvedTmdbId)}
                  bleed={false}
                />
              ) : null}
            </DeferredModalSections>
          ) : (
            <>
              {/^\d+$/.test(String(resolvedTmdbId)) ? (
                <MovieCollectionRail
                  key={`collection-${resolvedTmdbId}`}
                  movieId={String(resolvedTmdbId)}
                  bleed={false}
                />
              ) : null}
              {/^\d+$/.test(String(resolvedTmdbId)) ? (
                <YouMightLike
                  key={`yml-${resolvedTmdbId}`}
                  mediaType="movie"
                  id={String(resolvedTmdbId)}
                  bleed={false}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-0 flex h-[100dvh] w-full flex-col bg-black">
      <div className="relative min-h-0 flex-1 w-full">
        {!movieReleased ? (
          <>
            <ImmersiveWatchBackChrome />
            {trailerEmbedUrl ? (
            <MovieTrailerEmbed
              src={trailerEmbedUrl}
              title={`${movie.title} trailer`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-6">
              <CatalogComingSoon
                title={movie.title}
                posterUrl={imageUrl}
                releaseDate={movie.release_date}
                links={movieDetailLinks(movie)}
              />
            </div>
          )}
          </>
        ) : !streamHydrated ? (
          <ImmersiveWatchPageSkeleton />
        ) : (
          <>
            <MoviePlayer
              key={`movie-${resolvedTmdbId}-${playerEpoch}`}
              videoId={resolvedTmdbId}
              imdbId={movie.imdb_id}
              title={movie.title}
              posterUrl={imageUrl}
              backdropUrl={resolveMovieDetailsBannerUrl(movie)}
              server={server}
              immersive
              hideBackButton
              startSeconds={server === 'stremio' ? playerStartSeconds : 0}
              onStremioProgress={
                server === 'stremio' ? handleStremioProgress : undefined
              }
              onVidrockProgress={
                server === 'viduki' ? handleVidrockProgress : undefined
              }
              onEmbedLoad={handlePlayerReady}
            />
            <ImmersiveWatchBackChrome />
          </>
        )}
      </div>
    </div>
  );
}
