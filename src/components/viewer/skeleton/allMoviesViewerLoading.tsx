'use client';

import React from "react";
import SmallCardLoading from "../../ui/smallCardLoading";

export default function AllMoviesViewerLoading() {
  return (
    <div className="w-full h-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {Array.from({ length: 18 }).map((_, index) => (
        <SmallCardLoading key={index} />
      ))}
    </div>
  );
}
