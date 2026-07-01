"use client";

import { useMemo } from "react";
import postersManifest from "@/data/auth-collage-posters.json";

type PosterEntry = { id: string; src: string };

const ROW_COUNT = 6;
/** Posters per row before the seamless duplicate (wider = fewer gaps). */
const MIN_POSTERS_PER_ROW = 36;
const LOOP_COPIES = 2;

function uniquePosters(posters: PosterEntry[]): PosterEntry[] {
  const seen = new Set<string>();
  const out: PosterEntry[] = [];
  for (const poster of posters) {
    if (seen.has(poster.src)) continue;
    seen.add(poster.src);
    out.push(poster);
  }
  return out;
}

function postersByRow(posters: PosterEntry[], rows: number): PosterEntry[][] {
  const buckets = Array.from({ length: rows }, () => [] as PosterEntry[]);
  posters.forEach((poster, index) => {
    buckets[index % rows].push(poster);
  });

  const maxLen = Math.max(0, ...buckets.map((row) => row.length));
  return buckets
    .filter((row) => row.length > 0)
    .map((row) => {
      const target = Math.max(maxLen, MIN_POSTERS_PER_ROW);
      const padded: PosterEntry[] = [];
      for (let i = 0; i < target; i++) {
        padded.push(row[i % row.length]);
      }
      return padded;
    });
}

function PosterTile({ poster }: { poster: PosterEntry }) {
  return (
    <div className="relative h-[8.75rem] w-[5.75rem] shrink-0 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10 sm:h-[10.5rem] sm:w-[6.75rem]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={poster.src}
        alt=""
        loading="lazy"
        decoding="async"
        className="block h-full w-full rounded-xl object-cover object-center"
      />
    </div>
  );
}

function ScrollingRow({
  posters,
  direction,
  durationSec,
}: {
  posters: PosterEntry[];
  direction: "left" | "right";
  durationSec: number;
}) {
  const loop = Array.from({ length: LOOP_COPIES }, () => posters).flat();

  return (
    <div className="w-full overflow-hidden py-0.5">
      <div
        className={`flex w-max items-stretch gap-3 will-change-transform sm:gap-3.5 ${
          direction === "left" ? "auth-marquee-left" : "auth-marquee-right"
        }`}
        style={{ animationDuration: `${durationSec}s` }}
      >
        {loop.map((poster, index) => (
          <PosterTile key={`${poster.id}-${index}`} poster={poster} />
        ))}
      </div>
    </div>
  );
}

export default function AuthPosterCollage() {
  const rows = useMemo(() => {
    const unique = uniquePosters(
      (postersManifest.posters ?? []) as PosterEntry[]
    );
    return postersByRow(unique, ROW_COUNT);
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden bg-black"
      aria-hidden
    >
      <div
        className="absolute -inset-8 flex flex-col justify-center gap-2.5 sm:gap-3"
        style={{ transform: "rotate(-14deg) scale(1.4)" }}
      >
        {rows.map((row, rowIndex) => (
          <ScrollingRow
            key={`row-${rowIndex}`}
            posters={row}
            direction={rowIndex % 2 === 0 ? "left" : "right"}
            durationSec={110 + rowIndex * 12}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/20 to-black/80" />
    </div>
  );
}
