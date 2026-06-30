"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { pathUsesHeroBleed } from "@/lib/heroBleedPaths";
import { SIDEBAR_CONTENT_INSET } from "@/lib/sidebarInset";
import DesktopTopNav from "@/components/ui/desktopTopNav";

/**
 * Main column beside the fixed glass sidebar. Content scrolls full-width;
 * `SIDEBAR_CONTENT_INSET` keeps readable text aligned while bleed sections
 * can extend under the sidebar for the frosted reflection.
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
      className={`relative z-10 flex min-h-screen w-full min-w-0 flex-col ${
        heroBleed ? "pt-0" : "pt-14"
      }`}
    >
      <DesktopTopNav />
      <div
        className={`min-h-0 min-w-0 flex-1 ${SIDEBAR_CONTENT_INSET} ${
          heroBleed ? "overflow-x-clip" : "overflow-x-hidden"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
