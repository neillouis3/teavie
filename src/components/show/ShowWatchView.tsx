"use client";

import React from "react";
import {
  ShowEpisodePickerControls,
  ShowEpisodePickerList,
  ShowEpisodePickerProvider,
  ShowWatchPlayerHeading,
} from "@/components/show/ShowEpisodePicker";
import { SHOW_CONTENT_INSET_X } from "@/lib/contentInset";

type EpisodePickerProviderProps = Omit<
  React.ComponentProps<typeof ShowEpisodePickerProvider>,
  "children"
>;

type ShowWatchViewProps = {
  adminPreview: boolean;
  adminBypassActive: boolean;
  isAnimeMovie: boolean;
  title: string;
  playerBlock: React.ReactNode;
  episodePickerProps: EpisodePickerProviderProps;
};

export default function ShowWatchView({
  adminPreview,
  adminBypassActive,
  isAnimeMovie,
  title,
  playerBlock,
  episodePickerProps,
}: ShowWatchViewProps) {
  const watchMainContent = (
    <>
      <div className="flex w-full flex-col gap-4">
        {playerBlock}
        {!isAnimeMovie ? <ShowEpisodePickerControls /> : null}
      </div>
      <ShowWatchPlayerHeading title={title} />
      {!isAnimeMovie ? <ShowEpisodePickerList /> : null}
    </>
  );

  return (
    <div className="flex min-h-full w-full flex-col bg-background/92 px-0 pt-0 pb-32 dark:bg-background/88">
      {adminPreview && adminBypassActive ? (
        <div className="mb-3 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-center text-xs text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200">
          Admin preview — content policy bypass active
        </div>
      ) : null}
      <div className={`flex w-full flex-col gap-6 ${SHOW_CONTENT_INSET_X}`}>
        {!isAnimeMovie ? (
          <ShowEpisodePickerProvider {...episodePickerProps}>
            {watchMainContent}
          </ShowEpisodePickerProvider>
        ) : (
          watchMainContent
        )}
      </div>
    </div>
  );
}
