"use client";

import React, { useCallback, useState } from "react";
import {
  ShowEpisodePickerControls,
  ShowEpisodePickerList,
  ShowEpisodePickerProvider,
} from "@/components/show/ShowEpisodePicker";
import WatchEpisodesSheet from "@/components/show/WatchEpisodesSheet";
import WatchPlayerBackButton from "@/components/ui/watchPlayerBackButton";
import WatchPlayerChromeBar from "@/components/ui/watchPlayerChromeBar";
import { WatchOverlayProvider } from "@/contexts/watchOverlayContext";
import {
  WATCH_OVERLAY_LEFT_CLASS,
  WATCH_OVERLAY_TOP_CLASS,
} from "@/lib/watchChrome";
import { cn } from "@/lib/utils";

type EpisodePickerProviderProps = Omit<
  React.ComponentProps<typeof ShowEpisodePickerProvider>,
  "children"
>;

type ShowWatchViewProps = {
  adminPreview: boolean;
  adminBypassActive: boolean;
  isAnimeMovie: boolean;
  playerBlock: React.ReactNode;
  episodePickerProps: EpisodePickerProviderProps;
};

export default function ShowWatchView({
  adminPreview,
  adminBypassActive,
  isAnimeMovie,
  playerBlock,
  episodePickerProps,
}: ShowWatchViewProps) {
  const [episodesOpen, setEpisodesOpen] = useState(false);

  const closeEpisodes = useCallback(() => {
    setEpisodesOpen(false);
  }, []);

  const chromeBar = (
    <WatchPlayerChromeBar className="max-w-[calc(100vw-2rem-env(safe-area-inset-left)-env(safe-area-inset-right))]">
      <WatchPlayerBackButton className="relative left-0 top-0 z-30 shrink-0 sm:left-0 sm:top-0" />
      {!isAnimeMovie ? (
        <ShowEpisodePickerControls
          align="start"
          hideSeasonEpisodeJump
          bare
          compact
          onEpisodesPress={() => setEpisodesOpen((open) => !open)}
          episodesOpen={episodesOpen}
        />
      ) : null}
    </WatchPlayerChromeBar>
  );

  const overlay = (
    <div className="pointer-events-none absolute inset-0 z-[100]">
      <div
        className={cn(
          "pointer-events-auto absolute flex max-w-full flex-col items-start",
          WATCH_OVERLAY_TOP_CLASS,
          WATCH_OVERLAY_LEFT_CLASS
        )}
      >
        {chromeBar}
        {!isAnimeMovie && episodesOpen ? (
          <div className="mt-2 hidden w-[min(calc(100vw-2rem-env(safe-area-inset-left)-env(safe-area-inset-right)),28rem)] lg:block">
            <ShowEpisodePickerList variant="watch" />
          </div>
        ) : null}
      </div>
      {!isAnimeMovie ? (
        <WatchEpisodesSheet open={episodesOpen} onClose={closeEpisodes}>
          <ShowEpisodePickerList variant="watch" embedded />
        </WatchEpisodesSheet>
      ) : null}
    </div>
  );

  const watchMainContent = (
    <WatchOverlayProvider onPlaybackStart={closeEpisodes}>
      <div className="relative isolate h-full min-h-0 w-full">
        <div className="absolute inset-0 z-0">{playerBlock}</div>
        {overlay}
      </div>
    </WatchOverlayProvider>
  );

  return (
    <div className="fixed inset-0 z-40 flex h-[100dvh] w-full flex-col bg-black">
      {adminPreview && adminBypassActive ? (
        <div className="absolute left-1/2 top-4 z-30 w-[min(100%-2rem,28rem)] -translate-x-1/2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-center text-xs text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200">
          Admin preview — content policy bypass active
        </div>
      ) : null}
      {!isAnimeMovie ? (
        <ShowEpisodePickerProvider {...episodePickerProps}>
          {watchMainContent}
        </ShowEpisodePickerProvider>
      ) : (
        watchMainContent
      )}
    </div>
  );
}
