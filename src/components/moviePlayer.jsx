'use client';
import { forwardRef, useMemo } from 'react';
import VideoEmbedFrame from '@/components/videoEmbedFrame';
import { PlayerEmbedSkeleton } from '@/components/ui/playerEmbedSkeleton';
import WatchPlayerBackButton from '@/components/ui/watchPlayerBackButton';
import StremioPlayer from '@/components/stremioPlayerLazy';
import {
  MOVIES111_EMBED_BASE,
  MOVIES111_THEME_QUERY,
  VIDFAST_EMBED_BASE,
  VIDFAST_THEME_QUERY,
  VIDUKI_EMBED_BASE,
  VIDUKI_THEME_QUERY,
  withVidfastEmbedParams,
} from '@/lib/embedHosts';
import { cn } from '@/lib/utils';

export const MOVIE_SERVERS = {
  vidfast: {
    base: VIDFAST_EMBED_BASE,
    path: (id) => `/movie/${id}`,
    suffix: () => VIDFAST_THEME_QUERY,
  },
  viduki: {
    base: VIDUKI_EMBED_BASE,
    path: (id) => `/1/movie/${id}`,
    suffix: () => VIDUKI_THEME_QUERY,
  },
  movies111: {
    base: MOVIES111_EMBED_BASE,
    path: (id) => `/embed/movie/${id}`,
    suffix: () => MOVIES111_THEME_QUERY,
  },
  stremio: {
    base: '',
    path: () => '',
    suffix: () => '',
  },
};

/**
 * @param {object} props
 * @param {string | number} props.videoId
 * @param {string | null} [props.imdbId]
 * @param {string} [props.title]
 * @param {string | null} [props.posterUrl]
 * @param {string | null} [props.backdropUrl]
 * @param {string} [props.server]
 * @param {number} [props.startSeconds] Stremio resume position
 * @param {boolean} [props.immersive] Full-viewport watch page (no rounded shell)
 * @param {boolean} [props.hideBackButton] Skip in-player back (parent overlay owns it)
 * @param {(seconds: number) => void} [props.onStremioProgress]
 * @param {(progress: import('@/lib/vidrockProgress').VidrockProgress) => void} [props.onVidrockProgress]
 * @param {(progress: import('@/lib/vidfastProgress').VidfastProgress) => void} [props.onVidfastProgress]
 * @param {() => void} [props.onEmbedLoad]
 */
const MoviePlayer = forwardRef(function MoviePlayer(
  {
  videoId,
  imdbId,
  title,
  posterUrl,
  backdropUrl,
  server = 'vidfast',
  startSeconds = 0,
  immersive = false,
  hideBackButton = false,
  onStremioProgress,
  onVidrockProgress,
  onVidfastProgress,
  onEmbedLoad,
  },
  embedRef
) {
  const { playerUrl, playerError } = useMemo(() => {
    if (server === 'stremio') return { playerUrl: '', playerError: null };
    const config = MOVIE_SERVERS[server] ?? MOVIE_SERVERS.vidfast;
    const id = String(videoId ?? '').trim();
    if (!/^\d+$/.test(id)) {
      return { playerUrl: '', playerError: 'Missing TMDB movie id' };
    }
    const path = config.path(id);
    const suffix = typeof config.suffix === 'function' ? config.suffix() : '';
    const baseUrl = `${config.base}${path}${suffix}`;
    const playerUrl =
      server === 'vidfast'
        ? withVidfastEmbedParams(baseUrl, { startAt: startSeconds })
        : baseUrl;
    return { playerUrl, playerError: null };
  }, [videoId, server, startSeconds]);

  if (playerError) {
    return (
      <div
        className={cn(
          'flex h-full min-h-0 w-full items-center justify-center bg-black p-4',
          !immersive && 'rounded-lg ring-1 ring-white/10'
        )}
      >
        <p className="text-sm text-red-400">Error loading video: {playerError}</p>
      </div>
    );
  }

  const shellClass = cn(
    'relative h-full min-h-0 w-full touch-auto bg-black [touch-action:pan-x_pan-y_pinch-zoom]',
    immersive ? 'overflow-hidden' : 'rounded-lg ring-1 ring-white/10 lg:overflow-hidden'
  );

  return (
    server === 'stremio' ? (
      <div className={immersive ? 'relative h-full min-h-0 w-full' : undefined}>
        {!immersive && !hideBackButton ? <WatchPlayerBackButton /> : null}
        <StremioPlayer
          type="movie"
          imdbId={imdbId}
          catalogKey={videoId != null ? String(videoId) : null}
          startSeconds={startSeconds}
          title={title}
          posterUrl={posterUrl}
          backdropUrl={backdropUrl}
          onPlaybackProgress={onStremioProgress}
        />
      </div>
    ) : (
    <div className={shellClass}>
      {!hideBackButton ? <WatchPlayerBackButton /> : null}
      {playerUrl ? (
        <VideoEmbedFrame
          ref={embedRef}
          key={playerUrl}
          title="Movie player"
          src={playerUrl}
          className="absolute inset-0 h-full w-full border-0"
          vidrockTmdbId={String(videoId ?? '')}
          vidukiImdbId={imdbId}
          onVidrockProgress={server === 'viduki' ? onVidrockProgress : undefined}
          onVidfastProgress={server === 'vidfast' ? onVidfastProgress : undefined}
          onLoad={onEmbedLoad}
        />
      ) : (
        <PlayerEmbedSkeleton />
      )}
    </div>
    )
  );
});

export default MoviePlayer;
