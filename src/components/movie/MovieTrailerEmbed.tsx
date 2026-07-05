"use client";

import React from "react";
import VideoEmbedFrame from "@/components/videoEmbedFrame";

type MovieTrailerEmbedProps = {
  src: string;
  title: string;
};

export default function MovieTrailerEmbed({ src, title }: MovieTrailerEmbedProps) {
  return (
    <div className="relative h-full w-full bg-black">
      <VideoEmbedFrame
        src={src}
        title={title}
        className="absolute inset-0 h-full w-full border-0"
      />
      <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground backdrop-blur-sm dark:bg-background/60">
        Trailer
      </span>
    </div>
  );
}
