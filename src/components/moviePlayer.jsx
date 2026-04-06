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

  return (
    <div className="rounded-lg h-full w-full">
      {playerUrl ? (
        <iframe
          src={playerUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          className="block h-full w-full rounded-lg"
        />
      ) : (
        <p>Loading player...</p>
      )}
    </div>
  );
};

export default MoviePlayer;
