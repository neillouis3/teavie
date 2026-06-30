"use client";

import React, { Suspense } from "react";
import NavSearchBar from "@/components/ui/navSearchBar";
import ProfileNavAvatar from "@/components/ui/profileNavAvatar";
import WatchPartyNavButton from "@/components/watchParty/WatchPartyNavButton";
import ThemeNavButton from "@/components/ui/themeNavButton";
import { NAV_GLASS_CLASS, navChromeStyle, navOverHero } from "@/components/ui/navGlass";
import { pathUsesHeroBleed } from "@/lib/heroBleedPaths";
import { useScrollNavBlend } from "@/hooks/useScrollNavBlend";
import { usePathname } from "next/navigation";

function SearchFallback() {
  return (
    <div
      className="h-10 w-full animate-pulse rounded-lg bg-default-100"
      aria-hidden
    />
  );
}

/** Fixed top bar for lg+ (main column only, offset by --sidebar-w). */
export default function DesktopTopNav() {
  const pathname = usePathname();
  const heroBleed = pathUsesHeroBleed(pathname);
  const blend = useScrollNavBlend(heroBleed);
  const overHero = heroBleed && navOverHero(blend);

  const chromeStyle = heroBleed ? navChromeStyle(blend) : undefined;

  return (
    <header
      className={`fixed top-0 right-0 z-40 hidden h-14 items-center px-4 transition-[left,color] duration-200 ease-in-out lg:flex ${
        heroBleed ? "" : NAV_GLASS_CLASS
      } ${overHero ? "text-white" : "text-foreground"}`}
      style={{
        left: "var(--sidebar-w, 16rem)",
        ...chromeStyle,
      }}
    >
      <div className="grid w-full grid-cols-[1fr_minmax(0,28rem)_1fr] items-center gap-3">
        <div aria-hidden className="min-w-0" />
        <Suspense fallback={<SearchFallback />}>
          <NavSearchBar
            className="w-full min-w-0"
            size="sm"
            navBlend={heroBleed ? blend : undefined}
          />
        </Suspense>
        <div className="flex h-10 min-w-0 items-center justify-end gap-1">
          <WatchPartyNavButton overHero={overHero} />
          <ThemeNavButton overHero={overHero} />
          <ProfileNavAvatar />
        </div>
      </div>
    </header>
  );
}
