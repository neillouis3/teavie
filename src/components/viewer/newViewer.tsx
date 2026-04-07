'use client'
import React from "react";
import SmallCard from "../ui/smallCard";
import { ContentItem } from "@/types/content";

interface NewViewerProps {
  newContent: ContentItem[];
}

function toNumericId(id: ContentItem["id"]): number {
  if (typeof id === "number" && !Number.isNaN(id)) return id;
  const n = parseInt(String(id), 10);
  return Number.isFinite(n) ? n : 0;
}

export default function NewViewer({ newContent }: NewViewerProps) {
  return (
    <div className="grid w-full grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
      {newContent &&
        newContent.slice(0, 8).map((item, index) => {
          const title = item.title || item.name || "Untitled";
          const year =
            item.release_date?.split("-")[0] ||
            item.first_air_date?.split("-")[0] ||
            "N/A";

          return (
            <SmallCard
              key={index}
              id={toNumericId(item.id)}
              title={title}
              year={year}
              type={item.type || "movie"}
              runtimeSeconds={item.runtimeSeconds ?? undefined}
              seasonAmount={item.season_amount ?? 0}
              posterPath={item.poster_path || ""}
            />
          );
        })}
    </div>
  );
}
