'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
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
import { pickYoutubeTrailerEmbedUrl, type TmdbVideosPayload } from '@/lib/tmdbVideos';

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
  vote_average: number;
  tagline: string;
  homepage?: string | null;
  imdb_id?: string | null;
  release_dates?: unknown;
  credits?: MovieCreditsPayload;
  videos?: TmdbVideosPayload;
}

export type MovieServerKey = StreamServerId;

function isReleasedByDate(releaseDate: string | undefined | null): boolean {
  const d = String(releaseDate ?? "").trim();
  if (d.length < 10) return true;
  const ymd = d.slice(0, 10);
  return ymd <= new Date().toISOString().slice(0, 10);
}

function movieDetailLinks(movie: Movie): CatalogDetailLink[] {
  const links: CatalogDetailLink[] = [];
  if (movie.imdb_id && /^tt\d+/i.test(movie.imdb_id)) {
    links.push({
      href: `https://www.imdb.com/title/${movie.imdb_id}/`,
      label: "IMDb",
    });
  }
  const homepage = String(movie.homepage ?? "").trim();
  if (homepage) {
    links.push({ href: homepage, label: "Official site" });
  }
  return links;
}

export default function MovieTemplate({ id }: { id: string }) {
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

  const watchParty = useWatchParty({
    catalogId: id,
    mediaType: 'movie',
    title: movie?.title ?? '',
    roomIdFromUrl: partyRoomId,
    onGuestSync: applyGuestSync,
  });

  useEffect(() => {
    if (watchParty.room) return;
    setPlayerStartSeconds(loadMoviePlaybackPosition(String(id)));
    setPlayerEpoch((n) => n + 1);
  }, [id, watchParty.room]);

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
    [
      id,
      server,
      watchParty,
    ]
  );

  const handleCreateParty = useCallback(
    async (nickname: string) => {
      const roomId = await watchParty.createRoom(nickname);
      if (!roomId) return null;
      const params = new URLSearchParams(searchParams.toString());
      params.set('party', roomId);
      router.replace(`${pathname}?${params.toString()}`);
      return roomId;
    },
    [watchParty, searchParams, pathname, router]
  );

  const handleJoinParty = useCallback(
    (code: string, nickname: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('party', code.trim().toUpperCase());
      router.replace(`${pathname}?${params.toString()}`);
      void watchParty.joinRoom(code.trim().toUpperCase(), nickname);
    },
    [watchParty, searchParams, pathname, router]
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
      movieReleased
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
      watchParty.room,
      watchParty.isHost,
      watchParty.loading,
      partyNavError,
      watchParty.nickname,
      watchParty.sendChat,
      watchParty.updateSettings,
      watchParty.releaseSyncCheckpoint,
      watchParty.guestJoinSyncRole,
      handleCreateParty,
      handleJoinParty,
      handleLeaveParty,
    ]
  );

  useRegisterWatchPartyNav(watchPartyNavRegistration);

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
    if (movie?.title) {
      const year = movie.release_date?.slice(0, 4);
      document.title = year ? `${movie.title} (${year}) - Teavie` : `${movie.title} - Teavie`;
    }
  }, [movie]);

  useEffect(() => {
    if (!movie || loading || !movieReleased) return;
    recordMovieInWatchHistory(String(id));
  }, [id, movie, loading, movieReleased]);

  const imageUrl = tmdbImageUrl(movie?.poster_path);
  const trailerEmbedUrl =
    movie && !movieReleased
      ? pickYoutubeTrailerEmbedUrl(movie.videos)
      : null;

  if (loading) {
    return <WatchPageSkeleton />;
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

  return (
    <div className="flex h-full w-full flex-col bg-background/92 px-0 pt-0 pb-32 dark:bg-background/88">
      <div className="w-full  flex flex-col gap-6">
        <div className="aspect-video w-full max-h-[52vh] min-h-[200px] shrink-0 overflow-hidden rounded-lg bg-default-200 sm:max-h-[70vh] lg:aspect-auto lg:h-[min(80vh,900px)] lg:max-h-[80vh]">
          {movie && !movieReleased ? (
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
              onVideasyProgress={server === 'videasy' ? handleVideasyProgress : undefined}
              streamQuality={
                movie
                  ? inferMovieStreamQuality(
                      movie.release_dates,
                      movie.release_date
                    )
                  : undefined
              }
            />
          )}
        </div>

        <div className="flex w-full flex-col gap-6">
          {movie && <MovieCreditsStrip credits={movie.credits} />}
          {movie && (
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
                })}
                infoLines={buildMovieInfoLines(movie)}
                links={movieDetailLinks(movie)}
                toolbar={
                  <div className="flex flex-wrap items-center gap-2">
                    <FavoriteButton catalogId={String(id)} mediaType="movie" iconOnly />
                    <WatchLaterButton catalogId={String(id)} mediaType="movie" iconOnly />
                  </div>
                }
              />
          )}
        </div>

        <YouMightLike key={`yml-${id}`} mediaType="movie" id={id} />
      </div>
    </div>
  );
}
