'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import MoviePlayer from './moviePlayer';
import YouMightLike from './youMightLike';
import { useWatchParty } from '@/hooks/useWatchParty';
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
  const lastGuestPlaybackRef = useRef(-1);

  const partyRoomId = searchParams.get('party');

  const watchParty = useWatchParty({
    catalogId: id,
    mediaType: 'movie',
    title: movie?.title ?? '',
    roomIdFromUrl: partyRoomId,
    onGuestPlayback: (_season, _episode, seconds) => {
      const sec = Math.floor(seconds);
      if (
        lastGuestPlaybackRef.current >= 0 &&
        Math.abs(lastGuestPlaybackRef.current - sec) < 12
      ) {
        return;
      }
      lastGuestPlaybackRef.current = sec;
      setPlayerStartSeconds(sec);
      setPlayerEpoch((n) => n + 1);
    },
  });

  useEffect(() => {
    if (watchParty.room) return;
    setPlayerStartSeconds(loadMoviePlaybackPosition(String(id)));
    setPlayerEpoch((n) => n + 1);
  }, [id, watchParty.room]);

  const handleVideasyProgress = useCallback(
    (msg: VideasyProgressMessage) => {
      saveMoviePlaybackPosition(String(id), msg.timestamp);
      if (!watchParty.isHost || !watchParty.room || server !== 'videasy') return;
      const now = Date.now();
      if (now - partyPlaybackBroadcastRef.current < 4000) return;
      partyPlaybackBroadcastRef.current = now;
      void watchParty.broadcastPlayback(msg.timestamp);
    },
    [
      id,
      server,
      watchParty.isHost,
      watchParty.room,
      watchParty.broadcastPlayback,
    ]
  );

  const handleCreateParty = async (nickname: string) => {
    const roomId = await watchParty.createRoom(nickname);
    if (!roomId) return null;
    const params = new URLSearchParams(searchParams.toString());
    params.set('party', roomId);
    router.replace(`${pathname}?${params.toString()}`);
    return roomId;
  };

  const handleJoinParty = (code: string, nickname: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('party', code.trim().toUpperCase());
    router.replace(`${pathname}?${params.toString()}`);
    void watchParty.joinRoom(code.trim().toUpperCase(), nickname);
  };

  const handleLeaveParty = () => {
    watchParty.leaveRoom();
    const params = new URLSearchParams(searchParams.toString());
    params.delete('party');
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  };

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
            onCreate: handleCreateParty,
            onJoin: handleJoinParty,
            onLeave: handleLeaveParty,
            onSendChat: watchParty.sendChat,
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

        let catalogFallback: {
          imdb_genres?: string[];
          omdb?: { genre?: string | null };
        } | null = null;

        const resolveRes = await fetch(
          `/api/movie/resolve?id=${encodeURIComponent(id)}`
        );
        if (resolveRes.ok) {
          const resolved = await resolveRes.json();
          if (resolved?.fallback && typeof resolved.fallback === "object") {
            catalogFallback = resolved.fallback;
          }
        } else if (resolveRes.status === 404) {
          const err = await resolveRes.json().catch(() => null);
          if (err?.error === 'content_policy') {
            setMovie(null);
            setMovieUnavailableReason('content_policy');
            return;
          }
        }

        const url = `https://api.themoviedb.org/3/movie/${id}?language=en-US&append_to_response=release_dates`;
        const options = {
          method: 'GET',
          headers: {
            accept: 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_TMDB_BEARER}`,
          },
        };

        const res = await fetch(url, options);
        if (!res.ok) throw new Error('Failed to fetch movie details');
        const data = await res.json();
        if (catalogFallback?.imdb_genres?.length) {
          data.imdb_genres = catalogFallback.imdb_genres;
        }
        if (catalogFallback?.omdb) {
          data.omdb = catalogFallback.omdb;
        }
        setMovie(data);
      } catch (err) {
        console.error('Error fetching movie details:', err);
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
            <CatalogComingSoon
              title={movie.title}
              posterUrl={imageUrl}
              releaseDate={movie.release_date}
              links={movieDetailLinks(movie)}
            />
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

        <div className="w-full">
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
              />
          )}
        </div>

        <YouMightLike key={`yml-${id}`} mediaType="movie" id={id} />
      </div>
    </div>
  );
}
