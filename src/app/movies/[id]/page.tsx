'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import MovieTemplate from '@/components/movieTemplate';

const MoviePage = () => {
  const params = useParams();

  if (!params || typeof params.id !== 'string') {
    return <div>Error: Invalid movie ID</div>;
  }

  const movieId = params.id;

  return <MovieTemplate id={movieId} />;
};

export default MoviePage;
