"use client";

import React from "react";

const PLAYER_SHELL_CLASS =
  "aspect-video w-full max-h-[52vh] min-h-[200px] shrink-0 overflow-hidden rounded-xl bg-default-200 sm:max-h-[70vh] lg:aspect-auto lg:h-[min(80vh,900px)] lg:max-h-[80vh]";

/** Pulse placeholder for movie/TV/anime embed iframes. */
export function PlayerEmbedSkeleton({
  className = "",
  rounded = "rounded-lg",
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      className={`relative h-full min-h-0 w-full overflow-hidden bg-black ring-1 ring-white/10 ${rounded} ${className}`}
      aria-hidden
    >
      <div className="absolute inset-0 animate-pulse bg-default-200/90 dark:bg-default-100/15" />
    </div>
  );
}

export function WatchPlayerShell({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${PLAYER_SHELL_CLASS} ${className}`}>{children}</div>
  );
}

export { PLAYER_SHELL_CLASS };
