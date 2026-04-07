import React from "react";

export default function SmallCardLoading() {
  return (
    <div className="flex w-full min-w-0 flex-col rounded-xl">
      <div className="relative h-72 w-full shrink-0 overflow-hidden rounded-xl bg-default-200 animate-pulse">
        <div className="absolute inset-x-0 bottom-0 h-14 bg-default-300/60" />
      </div>
      <div className="w-full space-y-2 pt-2">
        <div className="flex flex-row items-center justify-between gap-2">
          <div className="h-3 max-w-12 flex-1 rounded bg-default-200 animate-pulse" />
          <div className="h-6 w-14 rounded-2xl bg-default-200 animate-pulse" />
          <div className="h-3 max-w-14 flex-1 rounded bg-default-200 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
