'use client';
import { useEffect, useState } from 'react';

export const SHOW_SERVERS = {
  '111movies': {
    base: 'https://111movies.com',
    path: (id, season, episode) => `/tv/${id}/${season}/${episode}`,
  },
  moviesapi: {
    base: 'https://moviesapi.club',
    path: (id, season, episode) => `/tv/${id}-${season}-${episode}`,
  },
};

const ShowPlayer = ({ videoId, season, episode, server = '111movies' }) => {
  const [playerUrl, setPlayerUrl] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      console.log(`Fetching show player URL for ID: ${videoId}, S${season}E${episode}`);

      const config = SHOW_SERVERS[server] ?? SHOW_SERVERS['111movies'];
      const url = `${config.base}${config.path(videoId, season, episode)}`;
      setPlayerUrl(url);
    } catch (err) {
      console.error('Error setting player URL:', err);
      setError(err.message || 'Unknown error');
    }
  }, [videoId, season, episode, server]);

  return (
    <div className="rounded-lg h-full w-full">
      {error ? (
        <p className="text-red-500">Error loading video: {error}</p>
      ) : (
        <iframe
          src={playerUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          className="rounded-lg h-full w-full"
        />
      )}
    </div>
  );
};

export default ShowPlayer;
