'use client';

import React from "react";

function SimilarCardLoading() {
  return (
    <div className="w-full h-20 flex flex-row rounded-lg overflow-hidden bg-default-100 border border-default-200/50">
      <div className="h-20 w-20 flex-shrink-0 bg-default-200 animate-pulse rounded-l-lg" />
      <div className="flex-1 flex flex-col justify-between px-4 py-2 min-w-0">
        <div className="h-3 w-32 rounded bg-default-200 animate-pulse" />
        <div className="h-4 w-full max-w-[80%] rounded bg-default-200 animate-pulse" />
      </div>
    </div>
  );
}

export default function UpdatedViewerLoading() {
  return (
    <div className="flex flex-col gap-2 h-fit">
      {Array.from({ length: 9 }).map((_, index) => (
        <SimilarCardLoading key={index} />
      ))}
    </div>
  );
}
