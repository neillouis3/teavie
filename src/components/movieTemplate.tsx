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
                <div className="h-8 sm:h-9 w-3/4 max-w-xl bg-default-200 rounded-lg animate-pulse" />
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <div className="h-6 w-14 rounded-full bg-default-200 animate-pulse" />
                  <div className="h-6 w-12 rounded-full bg-default-200 animate-pulse" />
                  <div className="h-6 w-12 rounded-full bg-default-200 animate-pulse" />
                  <div className="h-6 w-14 rounded-full bg-default-200 animate-pulse" />
                  <div className="h-6 w-16 rounded-full bg-default-200 animate-pulse" />
                </div>
              </section>
              <section className="mt-6 w-full rounded-xl border border-default-200/30 bg-default-50/40 p-3 sm:p-4 dark:border-default-100/15 dark:bg-default-50/5">
                <div className="flex flex-row gap-3 sm:gap-4">
                  <div className="w-24 shrink-0 sm:w-32 md:w-36">
                    <div className="aspect-[2/3] w-full animate-pulse rounded-lg bg-default-200" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="space-y-2">
                      <div className="h-3 w-full max-w-2xl rounded bg-default-200 animate-pulse" />
                      <div className="h-3 w-full max-w-xl rounded bg-default-200 animate-pulse" />
                      <div className="h-3 w-2/3 max-w-lg rounded bg-default-200 animate-pulse" />
                    </div>
                    <div className="h-3 w-4/5 max-w-md rounded bg-default-200 animate-pulse" />
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
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-default-600">
                    <Chip color="success" size="md" variant="flat" className="font-medium">
                      Movie
                    </Chip>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3.5 text-default-400" aria-hidden>
                        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                      </svg>
                      {movie.vote_average.toFixed(1)}
                    </span>
                    <span className="text-default-300" aria-hidden>
                      ·
                    </span>
                    <span className="tabular-nums">{movie.release_date?.slice(0, 4)}</span>
                    <span className="text-default-300" aria-hidden>
                      ·
                    </span>
                    <span className="tabular-nums">
                      {(() => {
                        const m = movie.runtimeSeconds != null ? Math.round(movie.runtimeSeconds / 60) : movie.runtime;
                        return m != null ? `${m} min` : "—";
                      })()}
                    </span>
                    <span className="text-default-300" aria-hidden>
                      ·
                    </span>
                    <span className="capitalize">{movie.status}</span>
                  </div>
                </section>

                <section className="mt-6 w-full rounded-xl border border-default-200/30 bg-default-50/40 p-3 sm:p-4 dark:border-default-100/15 dark:bg-default-50/5">
                  <div className="flex flex-row gap-3 sm:gap-4">
                    <div className="w-24 shrink-0 sm:w-32 md:w-36">
                      <Image
                        src={imageUrl}
                        alt={movie.title}
                        className="aspect-[2/3] w-full rounded-lg object-cover ring-1 ring-default-200/50 dark:ring-default-100/20"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed text-foreground/80">
                        {movie.overview}
                      </p>
                      {movie.tagline ? (
                        <p className="mt-2 text-xs text-default-500">&ldquo;{movie.tagline}&rdquo;</p>
                      ) : null}
                      <p className="mt-3 text-xs leading-snug text-default-500">
                        {formatCountryOfOrigin(movie)}
                        <span className="text-default-400"> · </span>
                        {movie.genres.map((g) => g.name).join(", ")}
                        <span className="text-default-400"> · </span>
                        {movie.release_date?.slice(0, 4) ?? "—"}
                      </p>
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
