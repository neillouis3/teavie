"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { pathUsesHeroBleed } from "@/lib/heroBleedPaths";
import DesktopTopNav from "@/components/ui/desktopTopNav";
import Footer from "@/components/ui/footer";

/** Main column beside the sidebar grid track (desktop) or full width (mobile). */
export default function MainWithSidebarOffset({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const heroBleed = pathUsesHeroBleed(pathname);

  return (
    <div
      className={`relative flex min-h-screen w-full min-w-0 flex-col overflow-x-hidden ${
        heroBleed ? "pt-0" : "pt-14"
      }`}
    >
      <DesktopTopNav />
      <div
        className={`min-h-0 min-w-0 flex-1 pl-0 ${heroBleed ? "overflow-x-clip" : "overflow-x-hidden"}`}
      >
        {children}
      </div>
      <Footer />
    </div>
  );
}
