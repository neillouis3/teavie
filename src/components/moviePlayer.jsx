'use client';
import { useEffect, useState } from 'react';
import VideoEmbedFrame from '@/components/videoEmbedFrame';
import { PlayerEmbedSkeleton } from '@/components/ui/playerEmbedSkeleton';
import StreamQualityBadge from '@/components/ui/streamQualityBadge';
import {
  VIDEASY_MOVIE_QUERY,
  VIDEASY_PLAYER_BASE,
} from '@/lib/videasyPlayer';

/** VidCore — https://vidcore.net (TMDB ids; theme is hex without #) */
const VIDCORE_QUERY = '?theme=22c55e&autoPlay=true';

export const MOVIE_SERVERS = {
  videasy: {
    base: VIDEASY_PLAYER_BASE,
    path: (id) => `/movie/${id}`,
    suffix: () => VIDEASY_MOVIE_QUERY,
  },
  vidcore: {
    base: 'https://vidcore.net',
    path: (id) => `/movie/${id}`,
    suffix: () => VIDCORE_QUERY,
  },
};

/**
 * @param {object} props
 * @param {string | number} props.videoId
 * @param {string} [props.server]
 * @param {'cam' | 'hd'} [props.streamQuality]
 */
const MoviePlayer = ({ videoId, server = 'videasy', streamQuality: streamQualityProp }) => {
  const [playerUrl, setPlayerUrl] = useState('');
  const [streamQuality, setStreamQuality] = useState(streamQualityProp ?? null);

  useEffect(() => {
    const config = MOVIE_SERVERS[server] ?? MOVIE_SERVERS.videasy;
    const path = config.path(videoId);
    const suffix = typeof config.suffix === 'function' ? config.suffix() : '';
    setPlayerUrl(`${config.base}${path}${suffix}`);
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

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
      {streamQuality ? <StreamQualityBadge quality={streamQuality} /> : null}
      {playerUrl ? (
        <VideoEmbedFrame
          title="Movie player"
          src={playerUrl}
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <PlayerEmbedSkeleton />
      )}
    </div>
  );
};

export default MoviePlayer;
