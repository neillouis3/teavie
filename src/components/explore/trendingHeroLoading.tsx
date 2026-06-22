"use client";

import React from "react";

const TRENDING_CAROUSEL_H = "h-[calc(80vh-2rem)]";

export default function TrendingHeroLoading() {
  return (
    <div className={`flex w-full flex-col items-center ${TRENDING_CAROUSEL_H}`}>
      <div className="h-[calc(100%-2rem)] w-full overflow-hidden">
        <div className="h-full w-full animate-pulse bg-default-200" />
      </div>
      <div className="mt-4 flex items-center justify-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-2 w-2 animate-pulse rounded-full bg-default-300"
          />
        ))}
      </div>
    </div>
  );
}
