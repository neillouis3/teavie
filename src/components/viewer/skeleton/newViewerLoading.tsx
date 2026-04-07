'use client';

import React from "react";
import SmallCardLoading from "../../ui/smallCardLoading";

export default function NewViewerLoading() {
  return (
    <div className="grid w-full grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <SmallCardLoading key={index} />
      ))}
    </div>
  );
}
