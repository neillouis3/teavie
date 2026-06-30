"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { pathUsesHeroBleed } from "@/lib/heroBleedPaths";
import { SIDEBAR_SCROLL_UNDERLAP } from "@/lib/sidebarInset";
import DesktopTopNav from "@/components/ui/desktopTopNav";

/**
 * Main column: content scrolls under the fixed glass sidebar (negative margin bleed),
 * with padding restoring readable alignment beside the nav.
 */
export default function MainWithSidebarOffset({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const heroBleed = pathUsesHeroBleed(pathname);

  return (
    <div
      className={`relative z-[1] flex min-h-screen w-full min-w-0 flex-col ${
        heroBleed ? "pt-0" : "pt-14"
      }`}
    >
      <DesktopTopNav />
      <div
        className={`min-h-0 min-w-0 flex-1 transition-[margin,width,padding] duration-200 ease-in-out ${SIDEBAR_SCROLL_UNDERLAP} ${
          heroBleed ? "overflow-x-clip" : "overflow-x-hidden"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
