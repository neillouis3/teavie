"use client";

import React from "react";

const TRENDING_CAROUSEL_H =
  "h-[min(52vh,400px)] sm:h-[min(62vh,480px)] lg:h-[calc(80vh-2rem)]";

export default function TrendingHeroLoading({
  rounded = false,
  showDots = true,
}: {
  rounded?: boolean;
  showDots?: boolean;
}) {
  return (
    <div
      className={`flex w-full flex-col items-center px-3 sm:px-4 ${TRENDING_CAROUSEL_H}`}
    >
      <div
        className={`w-full animate-pulse bg-default-200 ${
          showDots ? "h-[calc(100%-2rem)]" : "h-full"
        } ${rounded ? "overflow-hidden rounded-2xl" : "overflow-hidden"}`}
      />
      {showDots ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-2 w-2 animate-pulse rounded-full bg-default-300"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
