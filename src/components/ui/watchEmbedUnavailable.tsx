"use client";

import React from "react";
import { Button } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";
import { useAnimeAudio } from "@/contexts/animeAudioContext";
import { WATCH_CHROME_BLUR_CLASS } from "@/lib/watchChrome";
import { cn } from "@/lib/utils";

export type WatchEmbedUnavailableReason = "dub_unavailable" | "playback_unavailable";

const COPY: Record<
  WatchEmbedUnavailableReason,
  { heading: string; message: string }
> = {
  dub_unavailable: {
    heading: "Dub isn't available",
    message:
      "This episode doesn't have an English dub on our sources yet. Switch to Sub to keep watching.",
  },
  playback_unavailable: {
    heading: "Couldn't load this stream",
    message:
      "The player couldn't start for this episode. Try another audio track or come back later.",
  },
};

export type WatchEmbedUnavailableProps = {
  reason?: WatchEmbedUnavailableReason;
  backdropUrl?: string | null;
  className?: string;
  /** When false, only the blurred backdrop is shown (no card yet). */
  showContent?: boolean;
  /** When false, hide the switch-to-sub action (e.g. already on sub). */
  showSwitchToSub?: boolean;
};

export default function WatchEmbedUnavailable({
  reason = "playback_unavailable",
  backdropUrl = null,
  className,
  showContent = true,
  showSwitchToSub = false,
}: WatchEmbedUnavailableProps) {
  const { setAudio } = useAnimeAudio();
  const copy = COPY[reason] ?? COPY.playback_unavailable;

  return (
    <div
      className={cn(
        "absolute inset-0 z-20 flex items-center justify-center overflow-hidden",
        className
      )}
      role={showContent ? "alert" : undefined}
      aria-busy={!showContent}
    >
      {backdropUrl ? (
        <>
          <img
            src={backdropUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-3xl"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-black/55 backdrop-blur-md"
            aria-hidden
          />
        </>
      ) : (
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-xl"
          aria-hidden
        />
      )}

      {showContent ? (
        <div
          className={cn(
            "relative z-10 mx-4 w-full max-w-sm rounded-2xl px-8 py-10 text-center transition-opacity duration-300",
            WATCH_CHROME_BLUR_CLASS
          )}
        >
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06]">
            <HugeiconsIcon
              icon={Alert02Icon}
              size={28}
              className="text-white/80"
              strokeWidth={1.5}
            />
          </div>

          <h2 className="text-lg font-semibold text-white sm:text-xl">
            {copy.heading}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/65">
            {copy.message}
          </p>

          {showSwitchToSub ? (
            <Button
              className="mt-6 bg-white/10 text-sm font-normal text-white hover:bg-white/15"
              variant="flat"
              onPress={() => setAudio("sub")}
            >
              Switch to Sub
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
