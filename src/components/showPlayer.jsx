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

  const allow =
    'fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

  return (
    <div className="relative h-full w-full min-h-0 rounded-lg bg-black">
      {error ? (
        <p className="relative z-[1] p-4 text-sm text-red-400">Error loading video: {error}</p>
      ) : (
        <iframe
          title="Episode player"
          src={playerUrl}
          allow={allow}
          allowFullScreen
          className="absolute inset-0 h-full w-full rounded-lg border-0"
        />
      )}
    </div>
  );
};

export default ShowPlayer;
