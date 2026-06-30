"use client";

import React, { Suspense } from "react";
import NavSearchBar from "@/components/ui/navSearchBar";
import ProfileNavAvatar from "@/components/ui/profileNavAvatar";
import WatchPartyNavButton from "@/components/watchParty/WatchPartyNavButton";

function SearchFallback() {
  return (
    <div
      className="h-10 w-full animate-pulse rounded-lg bg-default-100"
      aria-hidden
    />
  );
}

/**
 * Sticky top bar for lg+ viewports (main column, beside the sidebar).
 */
export default function DesktopTopNav() {
  return (
    <header className="sticky top-0 z-40 hidden h-14 shrink-0 items-center border-b border-divider bg-background/95 px-4 backdrop-blur-md lg:flex">
      <div className="grid w-full grid-cols-[1fr_minmax(0,28rem)_1fr] items-center gap-3">
        <div aria-hidden className="min-w-0" />
        <Suspense fallback={<SearchFallback />}>
          <NavSearchBar className="w-full min-w-0" size="sm" />
        </Suspense>
        <div className="flex min-w-0 items-center justify-end gap-1">
          <WatchPartyNavButton />
          <ProfileNavAvatar />
        </div>
      </div>
    </header>
  );
}
