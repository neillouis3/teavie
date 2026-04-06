'use client';
import { useEffect, useState } from 'react';

export const MOVIE_SERVERS = {
  '111movies': { base: 'https://111movies.com', path: (id) => `/movie/${id}` },
  moviesapi: { base: 'https://moviesapi.club', path: (id) => `/movie/${id}` },
};

const MoviePlayer = ({ videoId, server = '111movies' }) => {
  const [playerUrl, setPlayerUrl] = useState('');

  useEffect(() => {
    const config = MOVIE_SERVERS[server] ?? MOVIE_SERVERS['111movies'];
    const url = `${config.base}${config.path(videoId)}`;
    setPlayerUrl(url);
  }, [videoId, server]);

  const allow =
    'fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

  return (
    <div className="relative h-full w-full min-h-0 rounded-lg bg-black">
      {playerUrl ? (
        <iframe
          title="Movie player"
          src={playerUrl}
          allow={allow}
          allowFullScreen
          className="absolute inset-0 h-full w-full rounded-lg border-0"
        />
      ) : (
        <p className="relative z-[1] p-4 text-sm text-white/80">Loading player...</p>
      )}
    </div>
  );
};

export default MoviePlayer;
