'use client';
import { useEffect, useState } from 'react';
import VideoEmbedFrame from '@/components/videoEmbedFrame';

/** Videasy — https://www.videasy.net/docs — overlay = Netflix-style pause overlay */
const VIDEASY_QUERY = '?color=22c55e&overlay=true';

/** VidCore — https://vidcore.net (TMDB ids; theme is hex without #) */
const VIDCORE_QUERY = '?theme=22c55e&autoPlay=true';

export const MOVIE_SERVERS = {
  videasy: {
    base: 'https://player.videasy.to',
    path: (id) => `/movie/${id}`,
    suffix: () => VIDEASY_QUERY,
  },
  vidcore: {
    base: 'https://vidcore.net',
    path: (id) => `/movie/${id}`,
    suffix: () => VIDCORE_QUERY,
  },
};

const MoviePlayer = ({ videoId, server = 'videasy' }) => {
  const [playerUrl, setPlayerUrl] = useState('');

  useEffect(() => {
    const config = MOVIE_SERVERS[server] ?? MOVIE_SERVERS.videasy;
    const path = config.path(videoId);
    const suffix = typeof config.suffix === 'function' ? config.suffix() : '';
    setPlayerUrl(`${config.base}${path}${suffix}`);
  }, [videoId, server]);

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
      {playerUrl ? (
        <VideoEmbedFrame
          title="Movie player"
          src={playerUrl}
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <p className="absolute inset-0 flex items-center justify-center p-4 text-sm text-white/70">
          Loading player…
        </p>
      )}
    </div>
  );
};

export default MoviePlayer;
