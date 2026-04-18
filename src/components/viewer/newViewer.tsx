'use client'
import React from "react";
import SmallCard from "../ui/smallCard";
import { ContentItem } from "@/types/content";
import { formatReleasePhrase } from "@/lib/formatRelease";

interface NewViewerProps {
  newContent: ContentItem[];
}

export default function NewViewer({ newContent }: NewViewerProps) {
  return (
    <div className="grid w-full grid-cols-3 gap-2 sm:gap-4 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
      {newContent &&
        newContent.slice(0, 8).map((item) => {
          const title = item.title || item.name || "Untitled";
          const rawDate = item.release_date ?? item.first_air_date ?? "";
          const year =
            rawDate?.split("-")[0] ||
            "N/A";
          const releaseNote =
            rawDate && String(rawDate).length >= 10
              ? formatReleasePhrase(rawDate)
              : undefined;

          return (
            <SmallCard
              key={`${item.type ?? "x"}-${item.id}`}
              id={item.id}
              title={title}
              year={year}
              releaseNote={releaseNote}
              type={item.type || "movie"}
              runtimeSeconds={item.runtimeSeconds ?? undefined}
              seasonAmount={item.season_amount ?? 0}
              numberOfEpisodes={item.number_of_episodes ?? undefined}
              posterPath={item.poster_path || ""}
            />
          );
        })}
    </div>
  );
}
