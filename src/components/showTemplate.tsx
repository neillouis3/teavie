'use client';

import React, { useState, useEffect } from "react";
import ShowPlayer, { SHOW_SERVERS } from "./showPlayer";
import YouMightLike from "./youMightLike";
import { Image, Chip, Button } from "@heroui/react";

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

export type ShowServerKey = keyof typeof SHOW_SERVERS;

export default function ShowTemplate({ id }: { id: string }) {
  const baseUrl = "https://image.tmdb.org/t/p/";
  const size = "w500";
  const [show, setShow] = useState<Show | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [server, setServer] = useState<ShowServerKey>("videasy");

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

  useEffect(() => {
    if (show?.name) {
      const year = show.first_air_date?.slice(0, 4);
      const seasonEpisode = `S${selectedSeason}E${selectedEpisode}`;
      document.title = year
        ? `${show.name} (${year}) ${seasonEpisode} - Teavie`
        : `${show.name} ${seasonEpisode} - Teavie`;
    }
  }, [show, selectedSeason, selectedEpisode]);

  const currentSeason = show?.seasons?.find((s) => s.season_number === selectedSeason);
  const episodeCount = currentSeason?.episode_count ?? 0;
  const imageUrl = show?.poster_path ? `${baseUrl}${size}${show.poster_path}` : "";
  const title = show?.name ?? "";
  const year = show?.first_air_date?.slice(0, 4) ?? "TBA";

  return (
    <div className="bg-background min-h-full w-full flex flex-col px-4 py-4 pb-32">
      <div className="w-full flex flex-col gap-6">

        {/* ── Video Player ── */}
        <div className="aspect-video w-full max-h-[52vh] min-h-[200px] shrink-0 overflow-hidden rounded-xl bg-default-200 sm:max-h-[70vh] lg:aspect-auto lg:h-[min(80vh,900px)] lg:max-h-[80vh]">
          {loading ? (
            <div className="h-full w-full animate-pulse bg-default-200" />
          ) : (
            <ShowPlayer
              videoId={show?.id ?? id}
              season={selectedSeason}
              episode={selectedEpisode}
              server={server}
            />
          )}
        </div>

        {/* ── Show Details ── */}
        <div className="w-full flex flex-col gap-4">
          {loading ? (
            <LoadingSkeleton />
          ) : (
            show && (
              <>
                {/* ── Title + Meta ── */}
                <section>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
                    {title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Chip color="success" size="md" variant="flat" className="font-medium">
                      TV
                    </Chip>
                    <Chip
                      size="md"
                      variant="flat"
                      color="warning"
                      startContent={
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                          <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                        </svg>
                      }
                      className="font-medium"
                    >
                      {show.vote_average.toFixed(1)}
                    </Chip>
                    <Chip size="md" variant="flat" className="font-medium">
                      {year}
                    </Chip>
                    <Chip size="md" variant="flat" className="font-medium capitalize">
                      {show.status}
                    </Chip>
                  </div>
                </section>

                {/* ── Season & Episode Chooser ── */}
                <div className="rounded-xl border border-default-200/60 bg-default-100/60 dark:bg-default-100/20 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-default-200/60">
                    <span className="text-sm font-medium text-foreground">Season & Episode</span>
                    {show.number_of_seasons && show.number_of_episodes && (
                      <span className="text-xs text-default-500">
                        {show.number_of_seasons} seasons · {show.number_of_episodes} eps
                      </span>
                    )}
                  </div>

                  {/* Season pills */}
                  <div className="px-4 pt-4 pb-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-default-500 mb-2.5">
                      Season
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {show.seasons
                        ?.filter((s) => s.season_number >= 1)
                        .map((s) => (
                          <Button
                            key={s.season_number}
                            size="sm"
                            variant={selectedSeason === s.season_number ? "solid" : "flat"}
                            color={selectedSeason === s.season_number ? "success" : "default"}
                            onPress={() => { setSelectedSeason(s.season_number); setSelectedEpisode(1); }}
                          >
                            Season {s.season_number}
                          </Button>
                        ))}
                    </div>
                  </div>

                  {/* Episode grid */}
                  {episodeCount > 0 && (
                    <div className="px-4 pb-4">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-default-500 mb-2.5">
                        Episode{selectedEpisode ? ` — ${selectedEpisode}` : ""}
                      </p>
                      <div
                        className="grid gap-1.5"
                        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))" }}
                      >
                        {Array.from({ length: episodeCount }, (_, i) => i + 1).map((ep) => (
                          <Button
                            key={ep}
                            size="sm"
                            isIconOnly
                            variant={selectedEpisode === ep ? "solid" : "flat"}
                            color={selectedEpisode === ep ? "success" : "default"}
                            onPress={() => setSelectedEpisode(ep)}
                            className="text-xs font-medium aspect-square"
                          >
                            {ep}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Selection summary bar */}
                  <div className="flex items-center gap-2 px-4 py-3 border-t border-default-200/60 bg-default-50/50 dark:bg-default-100/10">
                    <Chip size="md" variant="flat" color="success" className="font-mono">
                      S{selectedSeason}
                    </Chip>
                    <span className="text-default-400 text-xs">›</span>
                    <Chip size="md" variant="flat" color="success" className="font-mono">
                      E{selectedEpisode}
                    </Chip>
                  </div>
                </div>

                <section className="w-full  p-4 sm:p-5 rounded-xl bg-default-100/50 dark:bg-default-100/20 border border-default-200/50">
                  <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                    <div className="flex-shrink-0 w-full lg:w-48">
                      <Image
                        src={imageUrl}
                        alt={title}
                        className="w-full rounded-lg shadow-md object-cover aspect-[2/3]"
                      />
                    </div>
                    <div className="flex-1 min-w-0 ">
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

                      {/* Streaming Source */}
                      <div className="mt-12">
                        <div className="flex flex-col gap-2 p-3 rounded-lg border border-default-200">
                          <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                            Streaming Source
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {(Object.keys(SHOW_SERVERS) as ShowServerKey[]).map((key) => (
                              <Button
                                key={key}
                                size="sm"
                                variant={server === key ? "solid" : "flat"}
                                color={server === key ? "success" : "default"}
                                onPress={() => setServer(key)}
                              >
                                {key === "videasy"
                                  ? "Videasy"
                                  : key === "vidking"
                                    ? "Vidking"
                                    : key === "111movies"
                                      ? "111movies"
                                      : "MoviesAPI"}
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

        {!loading && <YouMightLike mediaType="tv" id={id} />}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <>
      <section className="w-full">
        <div className="h-8 sm:h-9 w-3/4 max-w-xl bg-default-200 rounded-lg animate-pulse" />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-6 w-14 rounded-full bg-default-200 animate-pulse" />
          ))}
        </div>
      </section>

      <div className="rounded-xl border border-default-200/60 bg-default-100/60 dark:bg-default-100/20 overflow-hidden">
        <div className="px-4 py-3.5 border-b border-default-200/60">
          <div className="h-4 w-36 bg-default-200 rounded animate-pulse" />
        </div>
        <div className="px-4 pt-4 pb-3">
          <div className="h-2.5 w-14 bg-default-200 rounded animate-pulse mb-2.5" />
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-20 bg-default-200 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="h-2.5 w-16 bg-default-200 rounded animate-pulse mb-2.5" />
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))" }}>
            {Array.from({ length: 13 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-default-200 animate-pulse" />
            ))}
          </div>
        </div>
      </div>

      <section className="w-full rounded-xl border border-default-200/60 overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          <div className="flex-shrink-0 w-full sm:w-36 lg:w-44 aspect-[2/3] bg-default-200 animate-pulse" />
          <div className="flex-1 p-4 sm:p-5 space-y-4">
            <div className="space-y-2">
              {[90, 75, 55].map((w, i) => (
                <div key={i} className="h-3 bg-default-200 rounded animate-pulse" style={{ width: `${w}%` }} />
              ))}
            </div>
            <div className="h-px bg-default-200" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-2.5 w-12 bg-default-200 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-default-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
            <div className="h-px bg-default-200" />
            <div className="space-y-2">
              <div className="h-2.5 w-28 bg-default-200 rounded animate-pulse" />
              <div className="flex gap-1.5">
                <div className="h-8 w-20 bg-default-200 rounded-lg animate-pulse" />
                <div className="h-8 w-20 bg-default-200 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}