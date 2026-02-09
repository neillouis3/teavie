'use client';
import { useEffect, useState } from 'react';

const MoviePlayer = ({ videoId, server = 'vidsrc' }) => {
  const [playerUrl, setPlayerUrl] = useState('');
  const [error, setError] = useState(null);


  useEffect(() => {
    try {
      console.log(`Fetching movie player URL for ID: ${videoId}`);

      let url = '';

      if (server === 'vidsrc') {
        url = `https://vidsrc.icu/embed/movie/${videoId}`;
      } else {
        url = `https://moviesapi.club/movie/${videoId}`;
      }

      setPlayerUrl(url);
    } catch (err) {
      console.error('Error setting player URL:', err);
      setError(err.message || 'Unknown error');
    }
  }, [videoId, server]);

  return (
    <div className="rounded-lg h-full w-full">
      {error ? (
        <p className="text-red-500">Error loading video: {error}</p>
      ) : playerUrl ? (
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
