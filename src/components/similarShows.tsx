'use client';

import React, { useState, useEffect } from 'react';
import SimilarCard from './similarCard';

const SimilarShows = ({ showId }: { showId: number }) => {
    const [shows, setShows] = useState<any[]>([]); // Array to store similar movies
    const [loading, setLoading] = useState<boolean>(true); // To handle loading state

    // Fetch similar movies when the component mounts or when movieId changes
    useEffect(() => {
        const fetchSimilarShows = async () => {
            setLoading(true); // Set loading to true while fetching
            setShows([]);
            try {
                const response = await fetch(`/api/fetchSimilarShows?show_id=${showId}`);
                const data = await response.json();

                if (response.ok) {
                    setShows(data); // Store the movies data in state
                } else {
                    console.error('Error fetching similar movies:', data.message);
                }
            } catch (error) {
                console.error('Error fetching similar movies:', error);
            }
            setLoading(false); // Set loading to false after fetching
        };

        fetchSimilarShows();
    }, [showId]); // Re-run effect if movieId changes

    if (loading) {
        return <div>Loading similar movies...</div>; // Show a loading state while fetching
    }

    // Create an array of exactly 5 movies, filling in with placeholders if necessary
    const displayShows = shows.length >= 5 
        ? shows.slice(0, 5) 
        : [...shows, ...Array(5 - shows.length).fill(null)];

    return (
        <div className="flex flex-col gap-4">
            {displayShows.map((movie, index) => (
                movie && movie.title && movie.release_year ? ( // Conditionally render only if movie has title and year
                    <SimilarCard 
                        key={index} 
                        title={movie.title} 
                        year={movie.release_year}
                        type={movie.type}
                        runtime={movie.runtime}
                        seasonAmount={0}
                        id={movie.id}
                        posterPath={movie.poster_path}
                    />
                ) : null // Skip rendering if it's a placeholder (null)
            ))}
        </div>
    );
};

export default SimilarShows;
