'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import VideoEmbedFrame from '@/components/videoEmbedFrame';
import { PlayerEmbedSkeleton } from '@/components/ui/playerEmbedSkeleton';
import StreamQualityBadge from '@/components/ui/streamQualityBadge';
import {
  VIDEASY_MOVIE_QUERY,
  VIDEASY_PLAYER_BASE,
  withVideasyProgress,
} from '@/lib/videasyPlayer';

/** 111movies — embed must use the final player host (111movies.net 302s and breaks fullscreen). */
const MOVIES111_BASE = 'https://player.vidlove.cc';

/** Peachify — embed on peachify.top (docs host; .pro breaks fullscreen). */
const PEACHIFY_BASE = 'https://peachify.top';

/** VidCore — https://vidcore.net (TMDB ids; theme is hex without #) */
const VIDCORE_QUERY = '?theme=22c55e&autoPlay=true';

export const MOVIE_SERVERS = {
  movies111: {
    base: MOVIES111_BASE,
    path: (id) => `/embed/movie/${id}`,
    suffix: () => '',
    supportsProgress: false,
  },
  peachify: {
    base: PEACHIFY_BASE,
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
    base: 'https://vidcore.net',
    path: (id) => `/movie/${id}`,
    suffix: () => VIDCORE_QUERY,
    supportsProgress: false,
  },
};

/**
 * @param {object} props
 * @param {string | number} props.videoId
 * @param {string} [props.server]
 * @param {'cam' | 'hd'} [props.streamQuality]
 * @param {number} [props.startSeconds] Videasy resume position
 * @param {(msg: import('@/lib/videasyProgress').VideasyProgressMessage) => void} [props.onVideasyProgress]
 */
const MoviePlayer = ({
  videoId,
  server = 'movies111',
  streamQuality: streamQualityProp,
  startSeconds = 0,
  onVideasyProgress,
}) => {
  const [streamQuality, setStreamQuality] = useState(streamQualityProp ?? null);

  const progressHandler = useCallback(
    (msg) => {
      onVideasyProgress?.(msg);
    },
    [onVideasyProgress]
  );

  const playerUrl = useMemo(() => {
    const config = MOVIE_SERVERS[server] ?? MOVIE_SERVERS.movies111;
    const path = config.path(videoId);
    let suffix = typeof config.suffix === 'function' ? config.suffix() : '';
    if (config.supportsProgress && startSeconds > 0) {
      suffix = withVideasyProgress(suffix, { progress: startSeconds });
    }
    return `${config.base}${path}${suffix}`;
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

  return (
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
  );
};

export default MoviePlayer;
