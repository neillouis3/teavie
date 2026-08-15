"use client";

import React from "react";
import VideoEmbedFrame from "@/components/videoEmbedFrame";
import DetailSectionHeader from "@/components/movie/DetailSectionHeader";
import { DETAIL_RAIL_SECTION_CLASS } from "@/lib/catalogGrid";

type MovieTrailerEmbedProps = {
  src: string;
  title: string;
  /** Details-page trailer: capped height with correct 16:9 width. */
  variant?: "default" | "details";
};

const TRAILER_DETAILS_SHELL =
  "relative aspect-video w-full overflow-hidden rounded-xl bg-black";

export default function MovieTrailerEmbed({
  src,
  title,
  variant = "default",
}: MovieTrailerEmbedProps) {
  if (variant === "details") {
    return (
      <section className={DETAIL_RAIL_SECTION_CLASS} aria-label="Trailer">
        <DetailSectionHeader>Trailer</DetailSectionHeader>
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
