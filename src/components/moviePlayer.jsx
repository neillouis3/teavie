'use client';
import { useEffect, useMemo, useState } from 'react';
import VideoEmbedFrame from '@/components/videoEmbedFrame';
import { PlayerEmbedSkeleton } from '@/components/ui/playerEmbedSkeleton';
import StreamQualityBadge from '@/components/ui/streamQualityBadge';
import WatchPlayerBackButton from '@/components/ui/watchPlayerBackButton';
import StremioPlayer from '@/components/stremioPlayerLazy';
import {
  MOVIES111_EMBED_BASE,
  PEACHIFY_EMBED_BASE,
  VIDCORE_EMBED_BASE,
  VIDCORE_THEME_QUERY,
  VIDROCK_EMBED_BASE,
  VIDROCK_MOVIE_QUERY,
} from '@/lib/embedHosts';
import { cn } from '@/lib/utils';

export const MOVIE_SERVERS = {
  stremio: {
    base: '',
    path: () => '',
    suffix: () => '',
  },
  vidrock: {
    base: VIDROCK_EMBED_BASE,
    path: (id) => `/movie/${id}`,
    suffix: () => VIDROCK_MOVIE_QUERY,
  },
  movies111: {
    base: MOVIES111_EMBED_BASE,
    path: (id) => `/embed/movie/${id}`,
    suffix: () => '',
  },
  peachify: {
    base: PEACHIFY_EMBED_BASE,
    path: (id) => `/embed/movie/${id}`,
    suffix: () => '',
  },
  vidcore: {
    base: VIDCORE_EMBED_BASE,
    path: (id) => `/movie/${id}`,
    suffix: () => VIDCORE_THEME_QUERY,
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
 * @param {'cam' | 'hd'} [props.streamQuality]
 * @param {number} [props.startSeconds] Stremio resume position
 * @param {boolean} [props.immersive] Full-viewport watch page (no rounded shell)
 * @param {(seconds: number) => void} [props.onStremioProgress]
 * @param {(progress: import('@/lib/vidrockProgress').VidrockProgress) => void} [props.onVidrockProgress]
 * @param {() => void} [props.onEmbedLoad]
 */
const MoviePlayer = ({
  videoId,
  imdbId,
  title,
  posterUrl,
  backdropUrl,
  server = 'vidrock',
  streamQuality: streamQualityProp,
  startSeconds = 0,
  immersive = false,
  onStremioProgress,
  onVidrockProgress,
  onEmbedLoad,
}) => {
  const [streamQuality, setStreamQuality] = useState(streamQualityProp ?? null);

  const { playerUrl, playerError } = useMemo(() => {
    if (server === 'stremio') return { playerUrl: '', playerError: null };
    const config = MOVIE_SERVERS[server] ?? MOVIE_SERVERS.vidrock;
    const id = String(videoId ?? '').trim();
    if (!/^\d+$/.test(id)) {
      return { playerUrl: '', playerError: 'Missing TMDB movie id' };
    }
    const path = config.path(id);
    const suffix = typeof config.suffix === 'function' ? config.suffix() : '';
    return { playerUrl: `${config.base}${path}${suffix}`, playerError: null };
  }, [videoId, server]);

  useEffect(() => {
    if (streamQualityProp) {
      setStreamQuality(streamQualityProp);
      return;
    }

    let cancelled = false;
    setStreamQuality(null);

    const id = String(videoId ?? '').trim();
    if (!/^\d+$/.test(id)) return;

    fetch(`/api/movie/stream-quality?id=${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (!res.ok) return { quality: 'hd' };
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const q = data?.quality === 'cam' ? 'cam' : 'hd';
        setStreamQuality(q);
      })
      .catch(() => {
        if (!cancelled) setStreamQuality('hd');
      });

    return () => {
      cancelled = true;
    };
  }, [videoId, streamQualityProp]);

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
        {immersive ? <WatchPlayerBackButton /> : null}
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
      <WatchPlayerBackButton />
      {streamQuality ? (
        <StreamQualityBadge
          quality={streamQuality}
          className="left-auto right-2 top-2 sm:right-3 sm:top-3"
        />
      ) : null}
      {playerUrl ? (
        <VideoEmbedFrame
          key={playerUrl}
          title="Movie player"
          src={playerUrl}
          className="absolute inset-0 h-full w-full border-0"
          vidrockTmdbId={String(videoId ?? '')}
          onVidrockProgress={server === 'vidrock' ? onVidrockProgress : undefined}
          onLoad={onEmbedLoad}
        />
      ) : (
        <PlayerEmbedSkeleton />
      )}
    </div>
    )
  );
};

export default MoviePlayer;
