import React from 'react';

export default function SmallCardLoading() {
  return (
    <div className="flex h-96 min-w-0 w-full flex-col rounded-xl">
      <div className="h-72 w-full shrink-0 animate-pulse rounded-xl bg-default-200" />
      <div className="flex w-full flex-1 flex-col gap-1 pt-2">
        <div className="flex flex-row items-center justify-between gap-2">
          <div className="h-3 max-w-12 flex-1 rounded bg-default-200 animate-pulse" />
          <div className="h-6 w-14 rounded-2xl bg-default-200 animate-pulse" />
          <div className="h-3 max-w-14 flex-1 rounded bg-default-200 animate-pulse" />
        </div>
        <div className="h-4 w-full max-w-[90%] rounded bg-default-200 animate-pulse" />
      </div>
    </div>
  );
}
