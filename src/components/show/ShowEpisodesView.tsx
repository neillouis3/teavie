"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import ShowEpisodesGrid from "@/components/show/ShowEpisodesGrid";
import PageBlurredBackdrop from "@/components/ui/pageBlurredBackdrop";
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
      <PageBlurredBackdrop imageUrl={backdropUrl} />
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
