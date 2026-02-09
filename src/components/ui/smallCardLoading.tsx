import React from "react";

export default function SmallCardLoading() {
  return (
    <div className="w-full min-w-0 h-96 flex flex-col rounded-xl">
      <div className="w-full h-72 rounded-xl bg-default-200 animate-pulse shrink-0" />
      <div className="flex-1 w-full pt-2 space-y-2">
        <div className="flex flex-row justify-between items-center gap-2">
          <div className="h-3 flex-1 max-w-12 rounded bg-default-200 animate-pulse" />
          <div className="h-6 w-14 rounded-2xl bg-default-200 animate-pulse" />
          <div className="h-3 flex-1 max-w-14 rounded bg-default-200 animate-pulse" />
        </div>
        <div className="h-4 w-full max-w-[90%] rounded bg-default-200 animate-pulse" />
      </div>
    </div>
  );
}
