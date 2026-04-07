'use client';
import { useEffect, useState } from 'react';
import { EMBED_IFRAME_ALLOW } from '@/lib/embedPlayerIframe';

/** Videasy — https://www.videasy.net/docs — overlay = Netflix-style pause overlay */
const VIDEASY_QUERY = '?color=22c55e&overlay=true';

/** Vidking — https://www.vidking.net */
const VIDKING_QUERY = '?color=22c55e';

export const MOVIE_SERVERS = {
  videasy: {
    base: 'https://player.videasy.net',
    path: (id) => `/movie/${id}`,
    suffix: () => VIDEASY_QUERY,
  },
  vidking: {
    base: 'https://www.vidking.net',
    path: (id) => `/embed/movie/${id}`,
    suffix: () => VIDKING_QUERY,
  },
  '111movies': { base: 'https://111movies.com', path: (id) => `/movie/${id}` },
  moviesapi: { base: 'https://moviesapi.club', path: (id) => `/movie/${id}` },
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
        <iframe
          title="Movie player"
          src={playerUrl}
          allow={EMBED_IFRAME_ALLOW}
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
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
