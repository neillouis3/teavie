import React from 'react';

export default function SmallCardLoading() {
  return (
    <div className="flex w-full min-w-0 flex-col rounded-xl">
      <div className="aspect-[2/3] w-full shrink-0 animate-pulse rounded-xl bg-default-200" />
      <div className="mt-2.5 w-full shrink-0 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <div className="h-5 w-10 animate-pulse rounded-md bg-default-200" />
          <div className="h-5 w-10 animate-pulse rounded-md bg-default-200" />
          <div className="h-5 w-8 animate-pulse rounded-md bg-default-200" />
          <div className="h-5 w-11 animate-pulse rounded-md bg-default-200" />
        </div>
        <div className="h-4 w-full max-w-[92%] animate-pulse rounded bg-default-200" />
      </div>
    </div>
  );
}
