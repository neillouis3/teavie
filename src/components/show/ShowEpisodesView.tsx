"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import ShowEpisodesGrid from "@/components/show/ShowEpisodesGrid";
import PageBlurredBackdrop from "@/components/ui/pageBlurredBackdrop";
import {
  PAGE_CONTENT_OUTER,
  PAGE_SHELL_MIN,
  PAGE_TITLE,
} from "@/lib/pageLayout";
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
    <div className={PAGE_SHELL_MIN}>
      <PageBlurredBackdrop imageUrl={backdropUrl} />
      <div className="relative z-10">
        {isAnimeMovie ? (
          <div className={`${PAGE_CONTENT_OUTER} items-center text-center`}>
            <h1 className={PAGE_TITLE}>{title}</h1>
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
