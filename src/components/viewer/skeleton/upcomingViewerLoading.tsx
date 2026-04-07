'use client';

import React from "react";

function LargeCardLoading() {
  return (
    <div className="aspect-video w-full animate-pulse overflow-hidden rounded-xl bg-default-200" />
  );
}

export default function UpcomingViewerLoading() {
  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full overflow-hidden -ml-4">
        <div className="flex gap-4 px-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex-[0_0_calc(66.666%-1rem)] min-w-0 shrink-0">
              <LargeCardLoading />
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-center items-center gap-2 mt-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-2 w-2 rounded-full bg-default-300 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
