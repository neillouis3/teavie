"use client";

import React from "react";
import { EpisodeGridSkeleton } from "@/components/show/ShowEpisodesGrid";

function BackdropSkeleton() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-black"
      aria-hidden
    >
      <div className="absolute inset-0 animate-pulse bg-zinc-900/80" />
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute left-[18%] top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
      <div className="absolute right-[18%] top-0 h-[28rem] w-[28rem] translate-x-1/2 rounded-full bg-rose-700/10 blur-[120px]" />
    </div>
  );
}

/** Loading shell for /shows/[id]/episodes — matches ShowEpisodesView layout. */
export default function ShowEpisodesPageSkeleton() {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden pb-24">
      <BackdropSkeleton />
      <div className="relative z-10">
        <div className="relative mx-auto flex w-full max-w-6xl flex-col px-4 pb-20 pt-20 sm:px-6 lg:px-8 lg:pt-24">
          <header className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
            <div className="mb-6 h-24 w-full max-w-md animate-pulse rounded-lg bg-white/5 sm:h-28 md:h-32" />
            <div className="h-3 w-48 animate-pulse rounded bg-white/5" />
            <nav
              className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
              aria-hidden
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-4 w-16 animate-pulse rounded bg-white/5" />
              ))}
            </nav>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <div className="h-8 w-24 animate-pulse rounded-full bg-white/5" />
              <div className="h-8 w-36 animate-pulse rounded-full bg-white/5 sm:w-44" />
            </div>
          </header>
          <section className="mt-12 w-full" aria-label="Episodes loading">
            <EpisodeGridSkeleton />
          </section>
        </div>
      </div>
    </div>
  );
}
