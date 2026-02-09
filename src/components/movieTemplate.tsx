'use client';

import React, { useState, useEffect } from 'react';
import Header from './ui/headerTemplate';
import MoviePlayer from './moviePlayer';
import { Image } from '@heroui/react';
import { Chip } from '@heroui/react';

interface Movie {
  id: number;
  title: string;
  release_date: string;
  status: string;
  runtime: number;
  overview: string;
  origin_country?: string[];
  genres: { id: number; name: string }[];
  poster_path: string;
  vote_average: number;
  tagline: string;
}

export default function MovieTemplate({ id }: { id: string }) {
  const baseUrl = 'https://image.tmdb.org/t/p/';
  const size = 'w500';

  const [server, setServer] = useState('vidsrc');
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        setLoading(true);

        const url = `https://api.themoviedb.org/3/movie/${id}?language=en-US`;
        const options = {
          method: 'GET',
          headers: {
            accept: 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_TMDB_BEARER}`,
          },
        };

        const res = await fetch(url, options);
        if (!res.ok) throw new Error('Failed to fetch movie details');
        const data = await res.json();
        setMovie(data);
      } catch (err) {
        console.error('Error fetching movie details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMovieDetails();
  }, [id]);

  const imageUrl = movie?.poster_path ? `${baseUrl}${size}${movie.poster_path}` : '';

  return (
    <div className="bg-background h-full w-full flex flex-col items-center px-4 py-2 pb-32">
      <div className="w-full h-20 items-center flex flex-row -ml-16 mb-4 ">
        <Header />
      </div>

      <div className="w-full h-full flex flex-row gap-4">
        <div className="w-full h-full flex-5">
          <div className="w-full h-[50vh] lg:h-[70vh]  rounded-lg flex flex-col bg-gray-500">
            <MoviePlayer videoId={id} server={server} />
          </div>

          {/* Movie details */}
          {loading ? (
            <div className="w-full h-18 mt-4 rounded-lg">
              <div className="w-[50%] h-10 bg-gray-500 rounded-lg"></div>
              <div className="w-[30%] h-4 bg-gray-500 mt-2 rounded-lg"></div>
            </div>
          ) : (
            movie && (
              <div className="w-full h-18 flex flex-col mt-4 text-foreground">
                
                <h1 className="text-3xl font-bold uppercase">{movie.title}</h1>
                <div className="flex flex-row  gap-2 h-fit items-center mt-2">
                <Chip color="success" size="md" variant="flat">
                  Movie
                </Chip>
                  <h1 className="text-md">{movie.vote_average.toFixed(1)}</h1>
                  <h1 className="text-md">{movie.release_date?.slice(0, 4)}</h1>
                  <h1 className="text-md">{movie.runtime} min</h1>
                  <h1 className="text-md">{movie.status}</h1>
                </div>
              </div>
            )
          )}

          {!loading && movie && (
            <div className="w-full lg:w-3/4 h-fit text-gray-500 flex flex-row gap-4 mt-4 rounded-lg bg-opacity-25 ">
              <div className="flex-1 rounded-md hidden lg:block">
                <Image src={imageUrl} alt={movie.title} className="w-full h-auto rounded-md" />
              </div>
              <div className="flex-5">
                <p className="text-md  w-full">{movie.overview}</p>
                <p className="text-md  mt-2 w-full">{movie.tagline}</p>
                <div className="mt-4 flex flex-row font-medium">
                  <div className="flex-1 flex flex-col gap-2">
                    <p className="text-md text-foreground">Country: </p>
                    <p className="text-md text-foreground">Genre:</p>
                    <p className="text-md text-foreground">Year:</p>
                  </div>
                  <div className="flex-4 text-foreground text-md flex flex-col gap-2">
                    <p>{movie.origin_country?.join(", ") || "N/A"}</p>
                    <p>{movie.genres.map((g) => g.name).join(", ")}</p>
                    <p>{movie.release_date?.slice(0, 4)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
