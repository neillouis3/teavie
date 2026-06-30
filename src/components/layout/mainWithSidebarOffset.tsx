"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebarContext";
import DesktopTopNav from "@/components/ui/desktopTopNav";

/** Routes whose hero should extend under the fixed top nav (no main pt-14). */
const HERO_BLEED_PATHS = ["/explore"];

function pathUsesHeroBleed(pathname: string) {
  return HERO_BLEED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/**
 * Reserves horizontal space for the fixed desktop sidebar so content is not covered.
 */
export default function MainWithSidebarOffset({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const heroBleed = pathUsesHeroBleed(pathname);

  return (
    <div
      className={`relative z-10 flex min-h-screen w-full min-w-0 flex-col transition-[padding-left] duration-200 ease-in-out ${
        heroBleed ? "pt-0" : "pt-14"
      } ${collapsed ? "lg:pl-16" : "lg:pl-64"}`}
    >
      <DesktopTopNav />
      <div
        className={`min-h-0 min-w-0 flex-1 ${heroBleed ? "overflow-x-clip" : "overflow-x-hidden"}`}
      >
        {children}
      </div>
    </div>
  );
}
