"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import ShowEpisodesGrid from "@/components/show/ShowEpisodesGrid";
import { ShowEpisodePickerProvider } from "@/components/show/ShowEpisodePicker";

type EpisodePickerProviderProps = Omit<
  React.ComponentProps<typeof ShowEpisodePickerProvider>,
  "children"
>;

type ShowEpisodesViewProps = {
  title: string;
  logoPath: string | null;
  year: string | undefined;
  certification: string | null;
  overview: string;
  backdropUrl: string | null;
  isAnimeMovie: boolean;
  watchHref: string;
  episodePickerProps: EpisodePickerProviderProps;
  onNavigateToEpisode: (season: number, episode: number) => void;
};

export default function ShowEpisodesView({
  title,
  logoPath,
  year,
  certification,
  overview,
  backdropUrl,
  isAnimeMovie,
  watchHref,
  episodePickerProps,
  onNavigateToEpisode,
}: ShowEpisodesViewProps) {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden pb-24">
      {backdropUrl ? (
        <div
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
          aria-hidden
        >
          <img
            src={backdropUrl}
            alt=""
            className="absolute inset-0 h-full w-full scale-105 object-cover object-[center_25%] blur-2xl brightness-[0.72] saturate-150"
          />
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute left-[18%] top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute right-[18%] top-0 h-[28rem] w-[28rem] translate-x-1/2 rounded-full bg-rose-700/10 blur-[120px]" />
        </div>
      ) : (
        <div
          className="pointer-events-none fixed inset-0 z-0 bg-black"
          aria-hidden
        />
      )}
      <div className="relative z-10">
        {isAnimeMovie ? (
          <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-16 text-center">
            <h1 className="text-3xl font-bold text-white">{title}</h1>
            <Button
              as={Link}
              href={watchHref}
              color="success"
              size="lg"
              radius="full"
              className="mt-8 w-fit"
            >
              Play
            </Button>
          </div>
        ) : (
          <ShowEpisodePickerProvider
            {...episodePickerProps}
            onEpisodeChange={onNavigateToEpisode}
          >
            <ShowEpisodesGrid
              title={title}
              logoPath={logoPath}
              year={year}
              certification={certification}
              overview={overview}
            />
          </ShowEpisodePickerProvider>
        )}
      </div>
    </div>
  );
}
