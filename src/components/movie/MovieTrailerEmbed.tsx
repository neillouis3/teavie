"use client";

import React from "react";
import VideoEmbedFrame from "@/components/videoEmbedFrame";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import { RAIL_INNER_CLASS } from "@/lib/catalogGrid";

type MovieTrailerEmbedProps = {
  src: string;
  title: string;
  /** Details-page trailer: capped height with correct 16:9 width. */
  variant?: "default" | "details";
};

const TRAILER_DETAILS_SHELL =
  "relative aspect-video w-full max-h-[52vh] max-w-[min(100%,calc(52vh*16/9))] overflow-hidden rounded-xl bg-black sm:max-h-[60vh] sm:max-w-[min(100%,calc(60vh*16/9))] lg:max-h-[min(56vh,640px)] lg:max-w-[min(100%,calc(min(56vh,640px)*16/9))]";

export default function MovieTrailerEmbed({
  src,
  title,
  variant = "default",
}: MovieTrailerEmbedProps) {
  if (variant === "details") {
    return (
      <section className={RAIL_INNER_CLASS} aria-label="Trailer">
        <ExploreSectionTitle variant="explore" hideIcon>
          Trailer
        </ExploreSectionTitle>
        <div className={TRAILER_DETAILS_SHELL}>
          <VideoEmbedFrame
            src={src}
            title={title}
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      </section>
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      <VideoEmbedFrame
        src={src}
        title={title}
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
