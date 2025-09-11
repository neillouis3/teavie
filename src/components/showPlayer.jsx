'use client';
import { useEffect, useState } from 'react';

const ShowPlayer = ({ videoId, season, episode, isTmdb, server }) => {
  const [playerUrl, setPlayerUrl] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPlayerUrl = async () => {
      try {
        console.log(`Fetching player URL for video ID: ${videoId}`);

        let playerUrl;
        if (server === 'vidsrc') {
          playerUrl = `https://vidsrc.icu/embed/tv/${videoId}/${season}/${episode}`;
        } else if (server === 'moviesapi') {
          playerUrl = `https://moviesapi.club/tv/${videoId}-${season}-${episode}`;
        } else {
          // Fallback to the Flask API or use `superembed` logic
          const response = await fetch(`http://localhost:5000/player?video_id=${videoId}&tmdb=${isTmdb ? 1 : 0}&season=${season}&episode=${episode}`);

          // Check if the response is okay
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          // Log the raw response text
          const responseText = await response.text();
          console.log('Raw response:', responseText);

          // Parse the response text as JSON
          const data = JSON.parse(responseText);
          console.log('Parsed response:', data);

          if (data.player_url) {
            playerUrl = data.player_url;
          } else {
            console.error('Error fetching player URL:', data.error);
            setError(data.error);
            return;
          }
        }

        // Set the player URL
        setPlayerUrl(playerUrl);
      } catch (error) {
        console.error('Error in fetchPlayerUrl:', error);
        setError(error.message);
      }
    };

    fetchPlayerUrl();
  }, [videoId, season, episode, isTmdb, server]);

  return (
    <div className='rounded-lg h-full w-full'>
      {error ? (
        <p>Error loading video: {error}</p>
      ) : (
        <iframe
          src={playerUrl}
          width="100%"
          height="100%"
          frameBorder="0"
          allowFullScreen
          className='rounded-lg h-full w-full'
        ></iframe>
      )}
    </div>
  );
};

export default ShowPlayer;
