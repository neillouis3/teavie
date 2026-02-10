'use client';
import { useEffect, useState } from 'react';

const PRIMARY_SERVER_BASE = 'https://111movies.com';
const FALLBACK_SERVER_BASE = 'https://moviesapi.club';

const ShowPlayer = ({ videoId, season, episode }) => {
  const [playerUrl, setPlayerUrl] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      console.log(`Fetching show player URL for ID: ${videoId}, S${season}E${episode}`);

      // Default server: 111movies
      const primaryUrl = `${PRIMARY_SERVER_BASE}/tv/${videoId}/${season}/${episode}`;

      // Optional fallback (kept for easy switching if needed):
      // const fallbackUrl = `${FALLBACK_SERVER_BASE}/tv/${videoId}-${season}-${episode}`;

      setPlayerUrl(primaryUrl);
    } catch (err) {
      console.error('Error setting player URL:', err);
      setError(err.message || 'Unknown error');
    }
  }, [videoId, season, episode]);

  return (
    <div className="rounded-lg h-full w-full">
      {error ? (
        <p className="text-red-500">Error loading video: {error}</p>
      ) : (
        <iframe
          src={playerUrl}
          width="100%"
          height="100%"
          frameBorder="0"
          allowFullScreen
          className="rounded-lg h-full w-full"
        />
      )}
    </div>
  );
};

export default ShowPlayer;
