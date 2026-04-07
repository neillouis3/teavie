'use client';

import React, { useState, useEffect } from 'react';
import MoviePlayer, { MOVIE_SERVERS } from './moviePlayer';
import { Image, Chip, Button } from '@heroui/react';

interface Movie {
  id: number;
  title: string;
  release_date: string;
  status: string;
  runtime?: number;
  runtimeSeconds?: number;
  overview: string;
  origin_country?: string[];
  genres: { id: number; name: string }[];
  poster_path: string;
  vote_average: number;
  tagline: string;
}

export type MovieServerKey = keyof typeof MOVIE_SERVERS;

export default function MovieTemplate({ id }: { id: string }) {
  const baseUrl = 'https://image.tmdb.org/t/p/';
  const size = 'w500';
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [server, setServer] = useState<MovieServerKey>('videasy');

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

  // Update page title when movie data loads
  useEffect(() => {
    if (movie?.title) {
      const year = movie.release_date?.slice(0, 4);
      document.title = year ? `${movie.title} (${year}) - Teavie` : `${movie.title} - Teavie`;
    }
  }, [movie]);

  const imageUrl = movie?.poster_path ? `${baseUrl}${size}${movie.poster_path}` : '';

  return (
    <div className="bg-background h-full w-full flex flex-col  px-4 py-4 pb-32">
      <div className="w-full  flex flex-col gap-6">
        {/* Video Player */}
        <div className="h-[80vh] max-h-[80vh] min-h-0 w-full shrink-0 overflow-hidden rounded-lg bg-default-200">
          {loading ? (
            <div className="h-full w-full animate-pulse rounded-lg bg-default-200" />
          ) : (
            <MoviePlayer videoId={id} server={server} />
          )}
        </div>

        
        {/* Movie Details */}
        <div className="w-full">
          {loading ? (
            <>
              <section className="w-full">
                <div className="h-8 sm:h-9 w-3/4 max-w-xl bg-default-200 rounded-lg animate-pulse" />
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <div className="h-6 w-14 rounded-full bg-default-200 animate-pulse" />
                  <div className="h-6 w-12 rounded-full bg-default-200 animate-pulse" />
                  <div className="h-6 w-12 rounded-full bg-default-200 animate-pulse" />
                  <div className="h-6 w-14 rounded-full bg-default-200 animate-pulse" />
                  <div className="h-6 w-16 rounded-full bg-default-200 animate-pulse" />
                </div>
              </section>
              <section className="w-full mt-6 p-4 sm:p-5 rounded-xl bg-default-100/50 dark:bg-default-100/20 border border-default-200/50">
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                  <div className="flex-shrink-0 w-full lg:w-48">
                    <div className="w-full rounded-lg bg-default-200 aspect-[2/3] animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="space-y-2">
                      <div className="h-3 w-full max-w-2xl bg-default-200 rounded animate-pulse" />
                      <div className="h-3 w-full max-w-xl bg-default-200 rounded animate-pulse" />
                      <div className="h-3 w-2/3 max-w-lg bg-default-200 rounded animate-pulse" />
                    </div>
                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3">
                      <div className="space-y-1">
                        <div className="h-3 w-14 bg-default-200 rounded animate-pulse" />
                        <div className="h-4 w-20 bg-default-200 rounded animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-3 w-12 bg-default-200 rounded animate-pulse" />
                        <div className="h-4 w-24 bg-default-200 rounded animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-3 w-10 bg-default-200 rounded animate-pulse" />
                        <div className="h-4 w-12 bg-default-200 rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-default-200">
                      <div className="h-4 w-32 bg-default-200 rounded animate-pulse mb-3" />
                      <div className="flex gap-2">
                        <div className="h-8 w-20 bg-default-200 rounded animate-pulse" />
                        <div className="h-8 w-20 bg-default-200 rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </>
          ) : (
            movie && (
              <>
                <section>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                    {movie.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Chip color="success" size="md" variant="flat" className="font-medium">
                      Movie
                    </Chip>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-warning/15 text-warning text-xs font-medium">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
                        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                      </svg>
                      {movie.vote_average.toFixed(1)}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-default-200/80 dark:bg-default-100/50 text-foreground/90 text-xs font-medium">
                      {movie.release_date?.slice(0, 4)}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-default-200/80 dark:bg-default-100/50 text-foreground/90 text-xs">
                      {(() => {
                        const m = movie.runtimeSeconds != null ? Math.round(movie.runtimeSeconds / 60) : movie.runtime;
                        return m != null ? `${m} min` : "—";
                      })()}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-default-200/80 dark:bg-default-100/50 text-foreground/90 text-xs capitalize">
                      {movie.status}
                    </span>
                  </div>
                </section>

                <section className="w-full mt-6 p-4 sm:p-5 rounded-xl bg-default-100/50 dark:bg-default-100/20 border border-default-200/50">
                  <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                    <div className="flex-shrink-0 w-full lg:w-48">
                      <Image
                        src={imageUrl}
                        alt={movie.title}
                        className="w-full rounded-lg shadow-md object-cover aspect-[2/3]"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base text-foreground/80 leading-relaxed">
                        {movie.overview}
                      </p>
                      {movie.tagline && (
                        <p className="mt-3 text-sm text-foreground/60 italic">
                          {movie.tagline}
                        </p>
                      )}
                      <dl className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                        <div>
                          <dt className="text-default-500 font-medium">Country</dt>
                          <dd className="text-foreground mt-0.5">
                            {movie.origin_country?.join(", ") || "N/A"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-default-500 font-medium">Genre</dt>
                          <dd className="text-foreground mt-0.5">
                            {movie.genres.map((g) => g.name).join(", ")}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-default-500 font-medium">Year</dt>
                          <dd className="text-foreground mt-0.5">
                            {movie.release_date?.slice(0, 4)}
                          </dd>
                        </div>
                      </dl>

                      {/* Streaming Source */}
                      <div className="mt-6">
                        <div className="flex flex-col gap-2 p-3 rounded-lg border border-default-200">
                          <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                            Streaming Source
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {(Object.keys(MOVIE_SERVERS) as MovieServerKey[]).map((key) => (
                              <Button
                                key={key}
                                size="sm"
                                variant={server === key ? 'solid' : 'flat'}
                                color={server === key ? 'success' : 'default'}
                                onPress={() => setServer(key)}
                              >
                                {key === 'videasy'
                                  ? 'Videasy'
                                  : key === 'vidking'
                                    ? 'Vidking'
                                    : key === '111movies'
                                      ? '111movies'
                                      : 'MoviesAPI'}
                              </Button>
                            ))}
                          </div>
                          <p className="text-foreground/60 text-[11px]">
                            We can&apos;t control ads or playback issues from third-party players.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )
          )}
        </div>

      </div>
    </div>
  );
}
