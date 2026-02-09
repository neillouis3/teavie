'use client';

import React, { useState, useEffect } from "react";
import SimilarShows from "./similarShows";
import Header from "./ui/headerTemplate";
import ShowPlayer from "./showPlayer";
import SimilarViewerLoading from "@/components/viewer/skeleton/similarViewerLoading";
import { Image } from "@heroui/react";
import { Chip } from "@heroui/react";

interface Season {
  season_number: number;
  episode_count: number;
}

interface Show {
  id: number;
  name: string;
  first_air_date: string;
  overview: string;
  poster_path: string | null;
  vote_average: number;
  status: string;
  genres: { id: number; name: string }[];
  origin_country?: string[];
  tagline?: string | null;
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: Season[];
}

export default function ShowTemplate({ id }: { id: string }) {
  const baseUrl = "https://image.tmdb.org/t/p/";
  const size = "w500";

  const [server, setServer] = useState("vidsrc");
  const [show, setShow] = useState<Show | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);

  useEffect(() => {
    const fetchShowDetails = async () => {
      try {
        setLoading(true);
        const url = `https://api.themoviedb.org/3/tv/${id}?language=en-US`;
        const options = {
          method: "GET",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_TMDB_BEARER}`,
          },
        };
        const res = await fetch(url, options);
        if (!res.ok) throw new Error("Failed to fetch show details");
        const data = await res.json();
        setShow(data);
        if (data.seasons?.length) {
          const firstSeason = data.seasons.find((s: Season) => s.season_number === 1) ?? data.seasons[0];
          setSelectedSeason(firstSeason.season_number);
        }
      } catch (err) {
        console.error("Error fetching show details:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchShowDetails();
  }, [id]);

  const currentSeason = show?.seasons?.find((s) => s.season_number === selectedSeason);
  const episodeCount = currentSeason?.episode_count ?? 0;
  const imageUrl = show?.poster_path ? `${baseUrl}${size}${show.poster_path}` : "";
  const title = show?.name ?? "";
  const year = show?.first_air_date?.slice(0, 4) ?? "TBA";

  return (
    <div className="bg-background h-full w-full flex flex-col items-center px-4 py-2 pb-32">
      <div className="w-full h-20 items-center flex flex-row -ml-16 mb-4">
        <Header />
      </div>

      <div className="w-full h-full flex flex-row gap-4">
        <div className="w-full h-full flex-5">
          <div className="w-full h-[50vh] lg:h-[70vh] rounded-lg flex flex-col bg-gray-500">
            {loading ? (
              <div className="bg-default-200 animate-pulse rounded-lg w-full h-full" />
            ) : (
              <ShowPlayer
                videoId={show?.id ?? id}
                season={selectedSeason}
                episode={selectedEpisode}
                isTmdb={1}
                server={server}
              />
            )}
          </div>

          {/* Show details */}
          {loading ? (
            <>
              <section className="mt-6 w-full">
                <div className="h-8 sm:h-9 w-3/4 max-w-xl bg-default-200 rounded-lg animate-pulse" />
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <div className="h-6 w-14 rounded-full bg-default-200 animate-pulse" />
                  <div className="h-6 w-12 rounded-full bg-default-200 animate-pulse" />
                  <div className="h-6 w-12 rounded-full bg-default-200 animate-pulse" />
                  <div className="h-6 w-14 rounded-full bg-default-200 animate-pulse" />
                  <div className="h-6 w-16 rounded-full bg-default-200 animate-pulse" />
                </div>
              </section>
              <section className="w-full lg:max-w-5xl mt-6 p-4 sm:p-5 rounded-xl bg-default-100/50 dark:bg-default-100/20 border border-default-200/50">
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                  <div className="flex-shrink-0 w-full lg:w-48 hidden lg:block">
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
                  </div>
                </div>
              </section>
            </>
          ) : (
            show && (
              <>
                <section className="mt-6">
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                    {title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Chip color="success" size="sm" variant="flat" className="font-medium">
                      TV
                    </Chip>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-warning/15 text-warning text-xs font-medium">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
                        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                      </svg>
                      {show.vote_average.toFixed(1)}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-default-200/80 dark:bg-default-100/50 text-foreground/90 text-xs font-medium">
                      {year}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-default-200/80 dark:bg-default-100/50 text-foreground/90 text-xs capitalize">
                      {show.status}
                    </span>
                  </div>
                </section>

                <section className="w-full  mt-6 p-4 sm:p-5 rounded-xl bg-default-100/50 dark:bg-default-100/20 border border-default-200/50">
                  <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                    <div className="flex-shrink-0 w-full lg:w-48 hidden lg:block">
                      <Image
                        src={imageUrl}
                        alt={title}
                        className="w-full rounded-lg shadow-md object-cover aspect-[2/3]"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base text-foreground/80 leading-relaxed">
                        {show.overview}
                      </p>
                      {show.tagline && (
                        <p className="mt-3 text-sm text-foreground/60 italic">
                          {show.tagline}
                        </p>
                      )}
                      <dl className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                        <div>
                          <dt className="text-default-500 font-medium">Country</dt>
                          <dd className="text-foreground mt-0.5">
                            {show.origin_country?.join(", ") || "N/A"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-default-500 font-medium">Genre</dt>
                          <dd className="text-foreground mt-0.5">
                            {show.genres?.map((g) => g.name).join(", ") ?? "N/A"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-default-500 font-medium">Year</dt>
                          <dd className="text-foreground mt-0.5">{year}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </section>
              </>
            )
          )}
        </div>

        <div className="w-full h-full flex-1 flex flex-col gap-4 lg:flex-2 min-w-0">
          {/* Server chooser */}
          {loading ? (
            <div className="w-full h-44 rounded-xl bg-default-200 animate-pulse" />
          ) : (
            <div className="w-full h-fit text-sm flex flex-col rounded-xl bg-default-100/60 dark:bg-default-100/20 border border-default-200/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold tracking-wide uppercase text-default-500">
                  Streaming servers
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-default-200 text-default-600">
                  Beta
                </span>
              </div>
              <p className="text-foreground/80 text-xs mt-1">
                If the current server doesn&apos;t work, switch to another option.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {["vidsrc", "moviesapi", "superembed"].map((s) => {
                  const label =
                    s === "vidsrc" ? "Vidsrc" : s === "moviesapi" ? "MoviesAPI" : "SuperEmbed";
                  const isActive = server === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setServer(s)}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                        isActive
                          ? "bg-primary/90 border-primary text-primary-foreground shadow-sm"
                          : "bg-background border-default-200 text-foreground hover:bg-default-100"
                      }`}
                      aria-pressed={isActive}
                      type="button"
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isActive ? "bg-success-400" : "bg-default-400"
                        }`}
                      />
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-default-500 text-[11px] mt-3 leading-snug">
                We can&apos;t control ads or playback issues from these third‑party players.
              </p>
            </div>
          )}

          {/* Season & episode */}
          {loading ? (
            <div className="w-full h-72 rounded-xl bg-default-200 animate-pulse" />
          ) : (
            show && (
              <div className="w-full h-fit flex flex-col rounded-xl bg-default-100/60 dark:bg-default-100/20 border border-default-200/60 p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-foreground">
                    Seasons & episodes
                  </label>
                  {show.number_of_seasons && show.number_of_episodes && (
                    <span className="text-[11px] text-default-500">
                      {show.number_of_seasons} seasons • {show.number_of_episodes} eps
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <span className="block text-xs font-medium text-default-500 mb-1">
                      Season
                    </span>
                    <select
                      value={selectedSeason}
                      onChange={(e) => {
                        setSelectedSeason(Number(e.target.value));
                        setSelectedEpisode(1);
                      }}
                      className="w-full p-2.5 rounded-lg bg-default-100 border border-default-200 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                    >
                      {show.seasons
                        ?.filter((s) => s.season_number >= 1)
                        .map((s) => (
                          <option key={s.season_number} value={s.season_number}>
                            Season {s.season_number}
                          </option>
                        ))}
                    </select>
                  </div>

                  {episodeCount > 0 && (
                    <div>
                      <span className="block text-xs font-medium text-default-500 mb-1">
                        Episode
                      </span>
                      <div className="max-h-40 overflow-y-auto rounded-lg bg-default-100/60 p-2">
                        <div className="grid grid-cols-6 gap-2">
                          {Array.from({ length: episodeCount }, (_, i) => (
                            <button
                              key={i + 1}
                              onClick={() => setSelectedEpisode(i + 1)}
                              className={`p-2 rounded-md text-xs font-medium transition-colors ${
                                selectedEpisode === i + 1
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "bg-default-200 text-foreground hover:bg-default-300"
                              }`}
                              type="button"
                            >
                              {i + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {episodeCount === 0 && currentSeason && (
                    <p className="text-default-500 text-sm mt-1">
                      No episodes listed for this season yet.
                    </p>
                  )}
                </div>
              </div>
            )
          )}

          {/* Similar shows
          {loading ? (
            <div className="mt-4">
              <div className="h-6 w-32 rounded-lg bg-default-200 animate-pulse mb-3" />
              <SimilarViewerLoading />
            </div>
          ) : (
            show && (
              <div className="mt-4">
                <h2 className="text-lg font-bold text-foreground mb-3">Similar Shows</h2>
                <SimilarShows showId={show.id} />
              </div>
            )
          )} */}
        </div>
      </div>
    </div>
  );
}
