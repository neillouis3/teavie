"use client";

import React, { Suspense } from "react";
import NavSearchBar from "@/components/ui/navSearchBar";
import ProfileNavAvatar from "@/components/ui/profileNavAvatar";
import WatchPartyNavButton from "@/components/watchParty/WatchPartyNavButton";
import { useSidebar } from "@/components/ui/sidebarContext";
import { NAV_GLASS_CLASS } from "@/components/ui/navGlass";

function SearchFallback() {
  return (
    <div
      className="h-10 w-full animate-pulse rounded-lg bg-default-100"
      aria-hidden
    />
  );
}

/**
 * Fixed top bar for lg+ viewports (main column, beside the sidebar).
 * Uses fixed positioning — sticky breaks when ancestors use overflow-x-hidden.
 */
export default function DesktopTopNav() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <header
      className={`fixed top-0 right-0 z-40 hidden h-14 items-center px-4 transition-[left] duration-200 ease-in-out lg:flex ${NAV_GLASS_CLASS} ${
        collapsed ? "left-16" : "left-64"
      }`}
    >
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
