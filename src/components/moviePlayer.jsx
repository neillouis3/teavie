'use client';
import { useEffect, useState } from 'react';

const PRIMARY_SERVER_BASE = 'https://111movies.com';
const FALLBACK_SERVER_BASE = 'https://moviesapi.club';

const MoviePlayer = ({ videoId }) => {
  const [playerUrl, setPlayerUrl] = useState('');

  useEffect(() => {
    console.log(`Fetching movie player URL for ID: ${videoId}`);

    // Default server: 111movies
    const primaryUrl = `${PRIMARY_SERVER_BASE}/movie/${videoId}`;

    // Optional fallback (kept for easy switching if needed):
    // const fallbackUrl = `${FALLBACK_SERVER_BASE}/movie/${videoId}`;

    setPlayerUrl(primaryUrl);
  }, [videoId]);

  return (
    <div className="rounded-lg h-full w-full">
      {playerUrl ? (
        <iframe
          src={playerUrl}
          width="100%"
          height="100%"
          frameBorder="0"
          allowFullScreen
          className="rounded-lg h-full w-full overflow-hidden"
        />
      ) : (
        <p>Loading player...</p>
      )}
    </div>
  );
};

export default MoviePlayer;
