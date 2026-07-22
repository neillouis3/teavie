'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@heroui/react';
import MoviePlayer from './moviePlayer';
import YouMightLike from './youMightLike';
import { useWatchParty } from '@/hooks/useWatchParty';
import type { GuestSyncPayload } from '@/lib/teaPartySync';
import { PARTY_HOST_BROADCAST_MS } from '@/lib/teaPartySync';
import { useRegisterWatchPartyNav } from '@/hooks/useRegisterWatchPartyNav';
import type { VideasyProgressMessage } from '@/lib/videasyProgress';
import {
  loadMoviePlaybackPosition,
  saveMoviePlaybackPosition,
} from '@/lib/movieWatchProgress';
import {
  buildMovieInfoLines,
  catalogGenresForDisplay,
  type CatalogDetailLink,
} from './ui/catalogDetailColumns';
import CatalogMediaPanel, {
  movieSubtitleLine,
} from './ui/catalogMediaPanel';
import WatchPageSkeleton from '@/components/ui/watchPageSkeleton';
import CatalogDetailsSkeleton from '@/components/ui/catalogDetailsSkeleton';
import { PLAYER_SHELL_CLASS } from '@/components/ui/playerEmbedSkeleton';
import CatalogComingSoon from './ui/catalogComingSoon';
import { useStreamingSource, type StreamServerId } from '@/contexts/streamingSourceContext';
import { recordMovieInWatchHistory } from '@/lib/watchHistory';
import { usCertificationFromDoc } from '@/lib/mapContentDocToItem';
import { tmdbImageUrl } from '@/lib/tmdbImage';
import { inferMovieStreamQuality } from '@/lib/streamQuality';
import { isBlockedMovieTmdbId } from '@/lib/tmdbMovieContentPolicy';
import CatalogUnavailable from './ui/catalogUnavailable';
import WatchLaterButton from '@/components/watchLater/WatchLaterButton';
import FavoriteButton from '@/components/favorites/FavoriteButton';
import MovieCreditsStrip, {
  type MovieCreditsPayload,
} from '@/components/movie/MovieCreditsStrip';
import MovieTrailerEmbed from '@/components/movie/MovieTrailerEmbed';
import ShowDetailsHero, {
  SHOW_DETAILS_HERO_OVERLAP,
} from '@/components/show/ShowDetailsHero';
import { pickYoutubeTrailerEmbedUrl, type TmdbVideosPayload } from '@/lib/tmdbVideos';
import { MOVIE_CONTENT_INSET_X } from '@/lib/contentInset';

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
  credits?: MovieCreditsPayload;
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

function buildMovieWatchHref(
  catalogId: string,
  opts?: { party?: string | null }
): string {
  const base = `/movies/${encodeURIComponent(catalogId)}/watch`;
  const party = opts?.party?.trim();
  if (!party) return base;
  const params = new URLSearchParams({ party });
  return `${base}?${params.toString()}`;
}

function resolveMovieDetailsBannerUrl(movie: Movie): string | null {
  const backdrop = tmdbImageUrl(movie.backdrop_path);
  if (backdrop) return backdrop;
  return tmdbImageUrl(movie.poster_path) || null;
}

export default function MovieTemplate({
  id,
  viewMode = 'details',
}: {
  id: string;
  viewMode?: MovieTemplateViewMode;
}) {
  const { server } = useStreamingSource();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [movieUnavailableReason, setMovieUnavailableReason] = useState<
    'content_policy' | 'not_found' | null
  >(null);
  const [playerStartSeconds, setPlayerStartSeconds] = useState(0);
  const [playerEpoch, setPlayerEpoch] = useState(0);
  const partyPlaybackBroadcastRef = useRef(0);

  const applyGuestSync = useCallback((plan: GuestSyncPayload) => {
    setPlayerStartSeconds(plan.targetSeconds);
    if (plan.remount) setPlayerEpoch((n) => n + 1);
  }, []);

  const partyRoomId = searchParams.get('party');
  const watchHref = buildMovieWatchHref(id, { party: partyRoomId });

  const watchParty = useWatchParty({
    catalogId: id,
    mediaType: 'movie',
    title: movie?.title ?? '',
    roomIdFromUrl: partyRoomId,
    onGuestSync: applyGuestSync,
  });

  useEffect(() => {
    if (watchParty.room) return;
    if (viewMode !== 'watch') return;
    setPlayerStartSeconds(loadMoviePlaybackPosition(String(id)));
    setPlayerEpoch((n) => n + 1);
  }, [id, watchParty.room, viewMode]);

  const handleVideasyProgress = useCallback(
    (msg: VideasyProgressMessage) => {
      saveMoviePlaybackPosition(String(id), msg.timestamp);
      watchParty.noteHostPlayback(msg.timestamp);
      if (!watchParty.isHost || !watchParty.room || server !== 'videasy') return;
      const now = Date.now();
      if (now - partyPlaybackBroadcastRef.current < PARTY_HOST_BROADCAST_MS) return;
      partyPlaybackBroadcastRef.current = now;
      void watchParty.broadcastPlayback(msg.timestamp);
    },
    [id, server, watchParty]
  );

  const handleCreateParty = useCallback(
    async (nickname: string) => {
      const roomId = await watchParty.createRoom(nickname);
      if (!roomId) return null;
      const params = new URLSearchParams(searchParams.toString());
      params.set('party', roomId);
      const path =
        viewMode === 'watch'
          ? pathname
          : `/movies/${encodeURIComponent(id)}/watch`;
      router.replace(`${path}?${params.toString()}`);
      return roomId;
    },
    [watchParty, searchParams, pathname, router, viewMode, id]
  );

  const handleJoinParty = useCallback(
    (code: string, nickname: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('party', code.trim().toUpperCase());
      const path =
        viewMode === 'watch'
          ? pathname
          : `/movies/${encodeURIComponent(id)}/watch`;
      router.replace(`${path}?${params.toString()}`);
      void watchParty.joinRoom(code.trim().toUpperCase(), nickname);
    },
    [watchParty, searchParams, pathname, router, viewMode, id]
  );

  const handleLeaveParty = useCallback(() => {
    watchParty.leaveRoom();
    const params = new URLSearchParams(searchParams.toString());
    params.delete('party');
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  }, [watchParty, searchParams, pathname, router]);

  const movieReleased = movie ? isReleasedByDate(movie.release_date) : false;

  const partyNavError =
    watchParty.room && watchParty.room.catalogId !== id
      ? 'This party is for a different title — open the shared link from the host.'
      : watchParty.error;

  const watchPartyNavRegistration = useMemo(
    () =>
      movieReleased && viewMode === 'watch'
        ? {
            canPlay: true,
            room: watchParty.room,
            isHost: watchParty.isHost,
            loading: watchParty.loading,
            error: partyNavError,
            nickname: watchParty.nickname,
            mediaType: 'movie' as const,
            title: movie?.title ?? '',
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
      movieReleased,
      viewMode,
      watchParty.room,
      watchParty.isHost,
      watchParty.loading,
      partyNavError,
      watchParty.nickname,
      watchParty.sendChat,
      watchParty.updateSettings,
      watchParty.releaseSyncCheckpoint,
      watchParty.guestJoinSyncRole,
      movie?.title,
      handleCreateParty,
      handleJoinParty,
      handleLeaveParty,
    ]
  );

  useRegisterWatchPartyNav(watchPartyNavRegistration);

  useEffect(() => {
    if (
      viewMode !== 'details' ||
      !partyRoomId ||
      loading ||
      !movie ||
      !movieReleased
    ) {
      return;
    }
    router.replace(watchHref);
  }, [viewMode, partyRoomId, loading, movie, movieReleased, watchHref, router]);

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        setLoading(true);
        setMovieUnavailableReason(null);

        if (isBlockedMovieTmdbId(id)) {
          setMovie(null);
          setMovieUnavailableReason('content_policy');
          return;
        }

        const resolveRes = await fetch(
          `/api/movie/resolve?id=${encodeURIComponent(id)}`
        );

        if (!resolveRes.ok) {
          const err = await resolveRes.json().catch(() => null);
          if (err?.error === 'content_policy') {
            setMovie(null);
            setMovieUnavailableReason('content_policy');
            return;
          }
          setMovie(null);
          setMovieUnavailableReason('not_found');
          return;
        }

        const resolved = await resolveRes.json();
        const catalogFallback: {
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
        } | null =
          resolved?.fallback && typeof resolved.fallback === 'object'
            ? resolved.fallback
            : null;

        let tmdbId = id;
        if (resolved?.playerId != null) {
          tmdbId = String(resolved.playerId);
        }

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
          return data;
        };

        if (!/^\d+$/.test(tmdbId)) {
          if (catalogFallback?.title) {
            setMovie({
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
            });
            return;
          }
          setMovie(null);
          setMovieUnavailableReason('not_found');
          return;
        }

        const detailsRes = await fetch(
          `/api/movie/details?id=${encodeURIComponent(tmdbId)}`
        );

        if (!detailsRes.ok) {
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

        const data = (await detailsRes.json()) as Movie;
        setMovie(applyCatalogFallback(data));
      } catch (err) {
        console.error('Error fetching movie details:', err);
        setMovie(null);
        setMovieUnavailableReason('not_found');
      } finally {
        setLoading(false);
      }
    };

    fetchMovieDetails();
  }, [id]);

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

  useEffect(() => {
    if (viewMode !== 'watch') return;
    if (!movie || loading || !movieReleased) return;
    recordMovieInWatchHistory(String(id));
  }, [id, movie, loading, movieReleased, viewMode]);

  const imageUrl = tmdbImageUrl(movie?.poster_path);
  const trailerEmbedUrl = movie
    ? pickYoutubeTrailerEmbedUrl(movie.videos)
    : null;

  if (loading) {
    return viewMode === 'details' ? (
      <CatalogDetailsSkeleton />
    ) : (
      <WatchPageSkeleton />
    );
  }

  if (!movie) {
    return (
      <CatalogUnavailable
        reason={
          movieUnavailableReason === 'content_policy'
            ? 'content_policy'
            : 'not_found'
        }
      />
    );
  }

  const movieDetailsPanel = (
    <div className="w-full">
      <CatalogMediaPanel
        posterUrl={imageUrl}
        posterAlt={movie.title}
        title={movie.title}
        subtitleLine={movieSubtitleLine(movie)}
        rating={movie.vote_average}
        certification={usCertificationFromDoc(movie)}
        status={movie.status}
        overview={movie.overview}
        tagline={movie.tagline}
        mediaType="movie"
        genres={catalogGenresForDisplay({
          imdb_genres: movie.imdb_genres,
          omdb: movie.omdb,
          genres: movie.genres,
        })}
        infoLines={buildMovieInfoLines(movie)}
        links={movieDetailLinks(movie)}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <FavoriteButton catalogId={String(id)} mediaType="movie" iconOnly />
            <WatchLaterButton catalogId={String(id)} mediaType="movie" iconOnly />
            {viewMode === 'details' && movieReleased ? (
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
        creditsSection={<MovieCreditsStrip credits={movie.credits} />}
      />
    </div>
  );

  const movieWatchSummary = (
    <div className="w-full">
      <CatalogMediaPanel
        compact
        posterUrl={imageUrl}
        posterAlt={movie.title}
        title={movie.title}
        subtitleLine={movieSubtitleLine(movie)}
        rating={movie.vote_average}
        certification={usCertificationFromDoc(movie)}
        overview={movie.overview}
        tagline={movie.tagline}
        mediaType="movie"
        genres={[]}
        infoLines={[]}
        links={[]}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <FavoriteButton catalogId={String(id)} mediaType="movie" iconOnly />
            <WatchLaterButton catalogId={String(id)} mediaType="movie" iconOnly />
            <Button
              as={Link}
              href={`/movies/${encodeURIComponent(id)}`}
              variant="flat"
              size="sm"
              radius="md"
              className="h-8 min-h-8 px-3 text-sm"
            >
              Details
            </Button>
          </div>
        }
      />
    </div>
  );

  if (viewMode === 'details') {
    const detailsBannerUrl = resolveMovieDetailsBannerUrl(movie);
    const hasDetailsHero = Boolean(detailsBannerUrl);

    return (
      <div className="flex w-full flex-col overflow-x-hidden bg-background pb-32">
        {hasDetailsHero ? (
          <ShowDetailsHero
            bannerUrl={detailsBannerUrl!}
            title={movie.title}
          />
        ) : null}
        <div
          className={`relative z-10 flex w-full flex-col gap-6 ${MOVIE_CONTENT_INSET_X} ${
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
          <YouMightLike key={`yml-${id}`} mediaType="movie" id={id} bleed={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full w-full flex-col bg-background/92 px-0 pt-0 pb-32 dark:bg-background/88">
      <div className={`flex w-full flex-col gap-6 ${MOVIE_CONTENT_INSET_X}`}>
        <div className={PLAYER_SHELL_CLASS}>
          {!movieReleased ? (
            trailerEmbedUrl ? (
              <MovieTrailerEmbed
                src={trailerEmbedUrl}
                title={`${movie.title} trailer`}
              />
            ) : (
              <CatalogComingSoon
                title={movie.title}
                posterUrl={imageUrl}
                releaseDate={movie.release_date}
                links={movieDetailLinks(movie)}
              />
            )
          ) : (
            <MoviePlayer
              key={`movie-${id}-${playerEpoch}`}
              videoId={id}
              server={server}
              startSeconds={server === 'videasy' ? playerStartSeconds : 0}
              onVideasyProgress={
                server === 'videasy' ? handleVideasyProgress : undefined
              }
              streamQuality={inferMovieStreamQuality(
                movie.release_dates,
                movie.release_date
              )}
            />
          )}
        </div>
        {movieWatchSummary}
        <YouMightLike key={`yml-${id}`} mediaType="movie" id={id} bleed={false} />
      </div>
    </div>
  );
}
