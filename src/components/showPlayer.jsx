'use client';
import { useEffect, useState } from 'react';
import {
  EMBED_IFRAME_ALLOW,
  EMBED_IFRAME_SANDBOX,
} from '@/lib/embedPlayerIframe';

/** Videasy TV — https://www.videasy.net/docs — overlay = Netflix-style pause overlay */
const VIDEASY_TV_QUERY =
  '?color=22c55e&nextEpisode=true&episodeSelector=true&overlay=true';

const VIDKING_QUERY = '?color=22c55e&nextEpisode=true&episodeSelector=true';

export const SHOW_SERVERS = {
  videasy: {
    base: 'https://player.videasy.net',
    path: (id, season, episode) => `/tv/${id}/${season}/${episode}`,
    suffix: () => VIDEASY_TV_QUERY,
  },
  vidking: {
    base: 'https://www.vidking.net',
    path: (id, season, episode) => `/embed/tv/${id}/${season}/${episode}`,
    suffix: () => VIDKING_QUERY,
  },
  '111movies': {
    base: 'https://111movies.com',
    path: (id, season, episode) => `/tv/${id}/${season}/${episode}`,
  },
  moviesapi: {
    base: 'https://moviesapi.club',
    path: (id, season, episode) => `/tv/${id}-${season}-${episode}`,
  },
};

const ShowPlayer = ({ videoId, season, episode, server = 'videasy' }) => {
  const [playerUrl, setPlayerUrl] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const config = SHOW_SERVERS[server] ?? SHOW_SERVERS.videasy;
      const path = config.path(videoId, season, episode);
      const suffix = typeof config.suffix === 'function' ? config.suffix() : '';
      setPlayerUrl(`${config.base}${path}${suffix}`);
      setError(null);
    } catch (err) {
      console.error('Error setting player URL:', err);
      setError(err.message || 'Unknown error');
    }
  }, [videoId, season, episode, server]);

  if (error) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center rounded-lg bg-black p-4 ring-1 ring-white/10">
        <p className="text-sm text-red-400">Error loading video: {error}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
      {playerUrl ? (
        <iframe
          title="Episode player"
          src={playerUrl}
          allow={EMBED_IFRAME_ALLOW}
          sandbox={EMBED_IFRAME_SANDBOX}
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

export default ShowPlayer;
