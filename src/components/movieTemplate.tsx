'use client';

import React, { useState, useEffect } from 'react';
import MoviePlayer from './moviePlayer';
import YouMightLike from './youMightLike';
import { Image, Chip } from '@heroui/react';
import { useStreamingSource, type StreamServerId } from '@/contexts/streamingSourceContext';

interface Movie {
  id: number;
  title: string;
  release_date: string;
  status: string;
  runtime?: number;
  runtimeSeconds?: number;
  overview: string;
  /** ISO 3166-1 alpha-2 codes (often co-productions); prefer {@link production_countries} for display. */
  origin_country?: string[];
  /** TMDB production countries — best match for “country of origin” copy. */
  production_countries?: { iso_3166_1?: string; name?: string }[];
  genres: { id: number; name: string }[];
  poster_path: string;
  vote_average: number;
  tagline: string;
}

export type MovieServerKey = StreamServerId;

function isReleasedByDate(releaseDate: string | undefined | null): boolean {
  const d = String(releaseDate ?? "").trim();
  if (d.length < 10) return true;
  const ymd = d.slice(0, 10);
  return ymd <= new Date().toISOString().slice(0, 10);
}

function formatCountryOfOrigin(movie: Movie): string {
  const prod = movie.production_countries;
  if (Array.isArray(prod) && prod.length > 0) {
    const names = prod
      .map((p) => String(p?.name ?? "").trim())
      .filter(Boolean);
    if (names.length > 0) return [...new Set(names)].join(", ");
  }
  const codes = movie.origin_country;
  if (Array.isArray(codes) && codes.length > 0) {
    return codes.map((c) => String(c).toUpperCase()).join(", ");
  }
  return "N/A";
}

export default function MovieTemplate({ id }: { id: string }) {
  const baseUrl = 'https://image.tmdb.org/t/p/';
  const size = 'w500';
  const { server } = useStreamingSource();
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

  // Update page title when movie data loads
  useEffect(() => {
    if (movie?.title) {
      const year = movie.release_date?.slice(0, 4);
      document.title = year ? `${movie.title} (${year}) - Teavie` : `${movie.title} - Teavie`;
    }
  }, [movie]);

  const imageUrl = movie?.poster_path ? `${baseUrl}${size}${movie.poster_path}` : '';
  const movieReleased = movie ? isReleasedByDate(movie.release_date) : false;
  const movieRuntimeMin =
    movie?.runtimeSeconds != null
      ? Math.round(movie.runtimeSeconds / 60)
      : movie?.runtime ?? null;
  const movieMetaLine =
    movie != null
      ? [
          movie.vote_average.toFixed(1),
          movie.release_date?.trim().slice(0, 4) || null,
          movieRuntimeMin != null ? `${movieRuntimeMin} min` : null,
          movie.status,
        ]
          .filter((x) => x != null && String(x).length > 0)
          .join(" · ")
      : "";

  return (
    <div className="bg-background h-full w-full flex flex-col  px-0 py-4 pb-32">
      <div className="w-full  flex flex-col gap-6">
        {/* Video Player (horizontal inset matches root py-4 / px-4) */}
        <div className="aspect-video w-full max-h-[52vh] min-h-[200px] shrink-0 overflow-hidden rounded-lg bg-default-200 sm:max-h-[70vh] lg:aspect-auto lg:h-[min(80vh,900px)] lg:max-h-[80vh]">
          {loading ? (
            <div className="h-full w-full animate-pulse rounded-lg bg-default-200" />
          ) : !movieReleased ? (
            <div className="flex h-full w-full items-center justify-center bg-black/80 px-6 text-center text-sm text-white/70">
              {movie?.release_date
                ? `This title is not available yet (releases ${movie.release_date.slice(0, 10)}).`
                : "Release date is not available; playback is disabled until a date is confirmed."}
            </div>
          ) : (
            <MoviePlayer videoId={id} server={server} />
          )}
        </div>

        
        {/* Movie Details */}
        <div className="w-full">
          {loading ? (
            <>
              <section className="w-full">
                <div className="h-8 sm:h-9 w-3/4 max-w-xl rounded-lg bg-default-200 animate-pulse" />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="h-7 w-16 rounded-full bg-default-200 animate-pulse" />
                  <div className="h-4 w-52 max-w-[75%] rounded bg-default-200 animate-pulse" />
                </div>
              </section>
              <section className="mt-6 w-full rounded-xl bg-default-100/30 p-4 sm:p-5 dark:bg-default-50/5">
                <div className="flex flex-row gap-4 sm:gap-6 lg:gap-8">
                  <div className="w-28 shrink-0 sm:w-36 md:w-40 lg:w-48">
                    <div className="aspect-[2/3] w-full animate-pulse rounded-lg bg-default-200" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="space-y-2">
                      <div className="h-3 w-full max-w-2xl bg-default-200 rounded animate-pulse" />
                      <div className="h-3 w-full max-w-xl bg-default-200 rounded animate-pulse" />
                      <div className="h-3 w-2/3 max-w-lg bg-default-200 rounded animate-pulse" />
                    </div>
                    <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <div className="h-3 w-14 rounded bg-default-200 animate-pulse" />
                        <div className="h-4 w-20 rounded bg-default-200 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-3 w-12 rounded bg-default-200 animate-pulse" />
                        <div className="h-4 w-24 rounded bg-default-200 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-3 w-10 rounded bg-default-200 animate-pulse" />
                        <div className="h-4 w-12 rounded bg-default-200 animate-pulse" />
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
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    {movie.title}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-default-600">
                    <Chip color="success" size="sm" variant="flat" className="font-medium">
                      Movie
                    </Chip>
                    <span className="text-default-500">{movieMetaLine}</span>
                  </div>
                </section>

                <section className="mt-6 w-full rounded-xl bg-default-100/30 p-4 sm:p-5 dark:bg-default-50/5">
                  <div className="flex flex-row gap-4 sm:gap-6 lg:gap-8">
                    <div className="w-28 shrink-0 sm:w-36 md:w-40 lg:w-48">
                      <Image
                        src={imageUrl}
                        alt={movie.title}
                        className="aspect-[2/3] w-full rounded-lg object-cover"
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
                      <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                        <div>
                          <dt className="text-xs text-default-400">Country of origin</dt>
                          <dd className="text-foreground mt-0.5">
                            {formatCountryOfOrigin(movie)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-default-400">Genre</dt>
                          <dd className="text-foreground mt-0.5">
                            {movie.genres.map((g) => g.name).join(", ")}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-default-400">Year</dt>
                          <dd className="text-foreground mt-0.5">
                            {movie.release_date?.slice(0, 4)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </section>
              </>
            )
          )}
        </div>

        {!loading && (
          <YouMightLike key={`yml-${id}`} mediaType="movie" id={id} />
        )}
      </div>
    </div>
  );
}
