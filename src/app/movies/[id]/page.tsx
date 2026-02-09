'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import MovieTemplate from '@/components/movieTemplate';

const fetchMovieData = async (movieId: number) => {
  // try {
  //   // Inject the movieId into the API URL
  //   const response = await fetch(`/api/fetchMovieDetails?movie_id=${movieId}`);
  //   if (!response.ok) {
  //     throw new Error('Error fetching data');
  //   }
  //   const data = await response.json();
  //   return data;
  // } catch (error) {
  //   console.error('Error fetching movie data:', error);
  //   return { movie: null, similar_movies: [] };
  // }
};

const MoviePage = () => {
  const params = useParams();

  // If params is null or 'id' is not a string, return an error message.
  if (!params || typeof params.id !== 'string') {
    return <div>Error: Invalid movie ID</div>;
  }

  // Convert 'id' to a number, as your MovieTemplate component expects a number type for movieId.
  const movieId = params.id;

  // Check if conversion failed (NaN), handle the error if necessary.


  // const [detailContent, setDetailContent] = useState(null);  // Initialize as null for better handling
  // const [similarContent, setSimilarContent] = useState([]);
  // const [loading, setLoading] = useState(true); // Add loading state

  // useEffect(() => {
  //   const getMovieData = async () => {
  //     const data = await fetchMovieData(movieId);
  //     setDetailContent(data.movie);
  //     setSimilarContent(data.similar_movies);
  //     setLoading(false); // Set loading to false once data is fetched
  //   };

  //   getMovieData();
  // }, [movieId]);

  // Pass the loading state and content to MovieTemplate
  return (
    <MovieTemplate
      id={movieId}
      // movie={detailContent}
      // similarContentData={similarContent}
      // loading={loading}  // Pass loading state to MovieTemplate
    />
  );
};

export default MoviePage;
