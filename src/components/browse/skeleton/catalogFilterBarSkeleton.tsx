"use client";

import React from "react";

/** Static pulse matching CatalogFilterBar select row layout. */
export default function CatalogFilterBarSkeleton({
  variant = "browse",
}: {
  variant?: "browse" | "search";
}) {
  return (
    <section
      className={`w-full ${variant === "browse" ? "mb-4 space-y-3" : "space-y-2"}`}
      aria-hidden
    >
      {variant === "browse" ? (
        <div className="h-9 w-full animate-pulse rounded-md bg-default-200 dark:bg-white/10" />
      ) : null}
      <div className="flex w-full flex-wrap items-end gap-2">
        <div className="h-9 w-full animate-pulse rounded-md bg-default-200 sm:w-32 dark:bg-white/10" />
        <div className="h-9 w-full animate-pulse rounded-md bg-default-200 sm:w-32 dark:bg-white/10" />
        <div className="h-9 w-full animate-pulse rounded-md bg-default-200 sm:w-24 dark:bg-white/10" />
        <div className="h-9 w-full animate-pulse rounded-md bg-default-200 sm:w-24 dark:bg-white/10" />
        <div className="h-9 w-16 shrink-0 animate-pulse rounded-md bg-default-200 dark:bg-white/10" />
      </div>
    </section>
  );
}
