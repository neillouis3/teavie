'use client';

import React, { useEffect, useState } from 'react';
import MoviePlayer from './moviePlayer';
import YouMightLike from './youMightLike';
import { Image, Chip } from '@heroui/react';
import { useStreamingSource, type StreamServerId } from '@/contexts/streamingSourceContext';

interface Movie {
  id: number;
  title: string;
  /** TMDB original title (often non-English). */
  original_title?: string;
  release_date: string;
  status: string;
  runtime?: number;
  runtimeSeconds?: number;
  overview: string;
  /** ISO 639-1 (e.g. `ja`, `en`). */
  original_language?: string;
  spoken_languages?: { iso_639_1?: string; english_name?: string; name?: string }[];
  /** ISO 3166-1 alpha-2 codes (often co-productions); prefer {@link production_countries} for display. */
  origin_country?: string[];
  /** TMDB production countries — best match for “country of origin” copy. */
  production_countries?: { iso_3166_1?: string; name?: string }[];
  production_companies?: { id?: number; name?: string }[];
  genres: { id: number; name: string }[];
  poster_path: string;
  vote_average: number;
  vote_count?: number;
  tagline: string;
  budget?: number;
  revenue?: number;
  homepage?: string | null;
  imdb_id?: string | null;
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

function languageDisplayName(code: string | undefined | null): string {
  const c = String(code ?? "").trim().toLowerCase();
  if (!c) return "—";
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(c) ?? c.toUpperCase();
  } catch {
    return c.toUpperCase();
  }
}

function formatFullReleaseDate(ymd: string | undefined | null): string {
  const d = String(ymd ?? "").trim();
  if (d.length < 10) return "—";
  const iso = d.slice(0, 10);
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatUsdCompact(n: number | undefined | null): string {
  if (n == null || typeof n !== "number" || n <= 0) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatSpokenLanguages(movie: Movie): string {
  const list = movie.spoken_languages;
  if (!Array.isArray(list) || list.length === 0) return "—";
  const names = list
    .map((l) => String(l?.english_name ?? l?.name ?? "").trim())
    .filter(Boolean);
  if (names.length > 0) return [...new Set(names)].join(", ");
  const codes = list.map((l) => String(l?.iso_639_1 ?? "").trim().toLowerCase()).filter(Boolean);
  if (codes.length === 0) return "—";
  return [...new Set(codes.map((c) => languageDisplayName(c)))].join(", ");
}

function formatProductionCompanies(movie: Movie): string {
  const list = movie.production_companies;
  if (!Array.isArray(list) || list.length === 0) return "—";
  const names = list
    .map((c) => String(c?.name ?? "").trim())
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : "—";
}

function formatVoteLine(movie: Movie): string {
  const va = movie.vote_average;
  const avg =
    typeof va === "number" && Number.isFinite(va) ? va.toFixed(1) : "—";
  const n = movie.vote_count;
  if (typeof n !== "number" || n < 1) return `${avg} / 10`;
  const votes = new Intl.NumberFormat(undefined).format(n);
  return `${avg} / 10 (${votes} votes)`;
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
    <div className="flex h-full w-full flex-col bg-background/92 px-0 py-4 pb-32 dark:bg-background/88">
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
              <section className="mt-6 w-full overflow-hidden rounded-xl border border-default-200/25 dark:border-default-100/15">
                <div className="bg-default-50 px-4 py-4 dark:bg-default-50/10 sm:px-5 sm:py-5">
                  <div className="flex flex-row gap-3 sm:gap-5">
                    <div className="w-24 shrink-0 sm:w-32 md:w-36">
                      <div className="aspect-[2/3] w-full animate-pulse rounded-md bg-default-200" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-4">
                      <div className="space-y-2">
                        <div className="h-3 w-full max-w-2xl rounded bg-default-200 animate-pulse" />
                        <div className="h-3 w-full max-w-xl rounded bg-default-200 animate-pulse" />
                        <div className="h-3 w-2/3 max-w-lg rounded bg-default-200 animate-pulse" />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <div key={i} className="space-y-1.5">
                            <div className="h-2.5 w-24 rounded bg-default-200 animate-pulse" />
                            <div className="h-4 w-full max-w-[14rem] rounded bg-default-200 animate-pulse" />
                          </div>
                        ))}
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
                    <Chip color="success" size="sm" variant="flat" className="font-normal">
                      Movie
                    </Chip>
                    <span className="rounded-full bg-default-200/80 px-2.5 py-1 text-xs font-normal text-foreground/90 dark:bg-default-100/50">
                      {movie.release_date?.slice(0, 4) ?? "—"}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-warning/15 text-warning text-xs font-medium">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
                        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                      </svg>
                      {movie.vote_average.toFixed(1)}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-default-200/80 text-foreground/90 text-xs font-medium dark:bg-default-100/50">
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

                <section className="mt-6 w-full overflow-hidden rounded-xl border border-default-200/25 dark:border-default-100/15">
                  <div className="bg-default-50 px-4 py-4 dark:bg-default-50/10 sm:px-5 sm:py-5">
                    <div className="flex flex-row gap-3 sm:gap-5">
                      <div className="w-24 shrink-0 sm:w-32 md:w-36 lg:w-40">
                        <Image
                          src={imageUrl}
                          alt={movie.title}
                          className="aspect-[2/3] w-full rounded-md object-cover ring-1 ring-default-200/35 dark:ring-default-100/15"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-relaxed text-foreground/85 sm:text-[15px]">
                          {movie.overview?.trim() ? movie.overview : "No overview available."}
                        </p>
                        {movie.tagline ? (
                          <p className="mt-2 text-xs text-default-500">&ldquo;{movie.tagline}&rdquo;</p>
                        ) : null}
                        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <dt className="text-default-500">Country of origin</dt>
                            <dd className="mt-0.5 text-foreground">{formatCountryOfOrigin(movie)}</dd>
                          </div>
                          <div>
                            <dt className="text-default-500">Genre</dt>
                            <dd className="mt-0.5 text-foreground">
                              {movie.genres?.length
                                ? movie.genres.map((g) => g.name).join(", ")
                                : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-default-500">Year</dt>
                            <dd className="mt-0.5 text-foreground">
                              {movie.release_date?.slice(0, 4) ?? "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-default-500">Release date</dt>
                            <dd className="mt-0.5 text-foreground">
                              {formatFullReleaseDate(movie.release_date)}
                            </dd>
                          </div>
                          {movie.original_title &&
                          String(movie.original_title).trim() !== String(movie.title).trim() ? (
                            <div>
                              <dt className="text-default-500">Original title</dt>
                              <dd className="mt-0.5 text-foreground">{movie.original_title}</dd>
                            </div>
                          ) : null}
                          <div>
                            <dt className="text-default-500">Original language</dt>
                            <dd className="mt-0.5 text-foreground">
                              {languageDisplayName(movie.original_language)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-default-500">Spoken languages</dt>
                            <dd className="mt-0.5 text-foreground">{formatSpokenLanguages(movie)}</dd>
                          </div>
                          <div className="sm:col-span-2 lg:col-span-2">
                            <dt className="text-default-500">Studios</dt>
                            <dd className="mt-0.5 text-foreground">{formatProductionCompanies(movie)}</dd>
                          </div>
                          <div>
                            <dt className="text-default-500">Budget</dt>
                            <dd className="mt-0.5 text-foreground">{formatUsdCompact(movie.budget)}</dd>
                          </div>
                          <div>
                            <dt className="text-default-500">Box office</dt>
                            <dd className="mt-0.5 text-foreground">{formatUsdCompact(movie.revenue)}</dd>
                          </div>
                          <div>
                            <dt className="text-default-500">User score</dt>
                            <dd className="mt-0.5 text-foreground">{formatVoteLine(movie)}</dd>
                          </div>
                          {movie.homepage || (movie.imdb_id && /^tt\d+/i.test(movie.imdb_id)) ? (
                            <div className="sm:col-span-2 lg:col-span-3">
                              <dt className="text-default-500">Links</dt>
                              <dd className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1">
                                {movie.imdb_id && /^tt\d+/i.test(movie.imdb_id) ? (
                                  <a
                                    href={`https://www.imdb.com/title/${movie.imdb_id}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary underline-offset-2 hover:underline"
                                  >
                                    IMDb
                                  </a>
                                ) : null}
                                {movie.homepage ? (
                                  <a
                                    href={movie.homepage}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary underline-offset-2 hover:underline"
                                  >
                                    Official site
                                  </a>
                                ) : null}
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
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
