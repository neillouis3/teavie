'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import VideoEmbedFrame from '@/components/videoEmbedFrame';
import { PlayerEmbedSkeleton } from '@/components/ui/playerEmbedSkeleton';
import StreamQualityBadge from '@/components/ui/streamQualityBadge';
import StremioPlayer from '@/components/stremioPlayer';
import {
  VIDEASY_MOVIE_QUERY,
  VIDEASY_PLAYER_BASE,
  withVideasyProgress,
} from '@/lib/videasyPlayer';
import {
  MOVIES111_EMBED_BASE,
  PEACHIFY_EMBED_BASE,
  VIDCORE_EMBED_BASE,
  VIDCORE_THEME_QUERY,
} from '@/lib/embedHosts';

export const MOVIE_SERVERS = {
  stremio: {
    base: '',
    path: () => '',
    suffix: () => '',
    supportsProgress: true,
  },
  movies111: {
    base: MOVIES111_EMBED_BASE,
    path: (id) => `/embed/movie/${id}`,
    suffix: () => '',
    supportsProgress: false,
  },
  peachify: {
    base: PEACHIFY_EMBED_BASE,
    path: (id) => `/embed/movie/${id}`,
    suffix: () => '',
    supportsProgress: false,
  },
  videasy: {
    base: VIDEASY_PLAYER_BASE,
    path: (id) => `/movie/${id}`,
    suffix: () => VIDEASY_MOVIE_QUERY,
    supportsProgress: true,
  },
  vidcore: {
    base: VIDCORE_EMBED_BASE,
    path: (id) => `/movie/${id}`,
    suffix: () => VIDCORE_THEME_QUERY,
    supportsProgress: false,
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
 * @param {number} [props.startSeconds] Videasy resume position
 * @param {(msg: import('@/lib/videasyProgress').VideasyProgressMessage) => void} [props.onVideasyProgress]
 * @param {(seconds: number) => void} [props.onStremioProgress]
 */
const MoviePlayer = ({
  videoId,
  imdbId,
  title,
  posterUrl,
  backdropUrl,
  server = 'peachify',
  streamQuality: streamQualityProp,
  startSeconds = 0,
  onVideasyProgress,
  onStremioProgress,
}) => {
  const [streamQuality, setStreamQuality] = useState(streamQualityProp ?? null);

  const progressHandler = useCallback(
    (msg) => {
      onVideasyProgress?.(msg);
    },
    [onVideasyProgress]
  );

  const stremioProgressHandler = useCallback(
    (seconds) => {
      onStremioProgress?.(seconds);
    },
    [onStremioProgress]
  );

  const { playerUrl, playerError } = useMemo(() => {
    if (server === 'stremio') return { playerUrl: '', playerError: null };
    const config = MOVIE_SERVERS[server] ?? MOVIE_SERVERS.peachify;
    const id = String(videoId ?? '').trim();
    if (!/^\d+$/.test(id)) {
      return { playerUrl: '', playerError: 'Missing TMDB movie id' };
    }
    const path = config.path(id);
    let suffix = typeof config.suffix === 'function' ? config.suffix() : '';
    if (config.supportsProgress && startSeconds > 0) {
      suffix = withVideasyProgress(suffix, { progress: startSeconds });
    }
    return { playerUrl: `${config.base}${path}${suffix}`, playerError: null };
  }, [videoId, server, startSeconds]);

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
      <div className="flex h-full min-h-0 w-full items-center justify-center rounded-lg bg-black p-4 ring-1 ring-white/10">
        <p className="text-sm text-red-400">Error loading video: {playerError}</p>
      </div>
    );
  }

  return (
    server === 'stremio' ? (
      <StremioPlayer
        type="movie"
        imdbId={imdbId}
        catalogKey={videoId != null ? String(videoId) : null}
        startSeconds={startSeconds}
        title={title}
        posterUrl={posterUrl}
        backdropUrl={backdropUrl}
        onPlaybackProgress={onStremioProgress ? stremioProgressHandler : undefined}
      />
    ) : (
    <div className="relative h-full min-h-0 w-full touch-auto rounded-lg bg-black ring-1 ring-white/10 [touch-action:pan-x_pan-y_pinch-zoom] lg:overflow-hidden">
      {streamQuality ? <StreamQualityBadge quality={streamQuality} /> : null}
      {playerUrl ? (
        <VideoEmbedFrame
          key={playerUrl}
          title="Movie player"
          src={playerUrl}
          className="absolute inset-0 h-full w-full border-0"
          onVideasyProgress={server === 'videasy' ? progressHandler : undefined}
        />
      ) : (
        <PlayerEmbedSkeleton />
      )}
    </div>
    )
  );
};

export default MoviePlayer;
