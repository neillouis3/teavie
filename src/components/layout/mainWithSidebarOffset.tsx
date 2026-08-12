"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { pathUsesHeroBleed } from "@/lib/heroBleedPaths";
import DesktopTopNav from "@/components/ui/desktopTopNav";
import Footer from "@/components/ui/footer";
import { CatalogStreamingOutageBanner } from "@/components/ui/catalogStreamingOutageAlert";

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
      className={`relative flex min-h-screen w-full min-w-0 flex-col overflow-x-clip lg:overflow-x-visible ${
        heroBleed ? "pt-0" : "pt-14 lg:pt-24"
      }`}
    >
      <DesktopTopNav />
      <CatalogStreamingOutageBanner />
      <div
        className={`min-h-0 min-w-0 flex-1 pl-0 ${
          heroBleed
            ? "relative overflow-x-visible"
            : "overflow-x-clip lg:overflow-x-visible"
        }`}
      >
        {children}
      </div>
      <Footer />
    </div>
  );
}
