'use client';
import { useEffect, useState } from 'react';

const MoviePlayer = ({ videoId }) => {
  const [playerUrl, setPlayerUrl] = useState('');

  useEffect(() => {
    console.log(`Fetching movie player URL for ID: ${videoId}`);

    // Only use moviesapi for movie playback
    const url = `https://moviesapi.club/movie/${videoId}`;
    setPlayerUrl(url);
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
