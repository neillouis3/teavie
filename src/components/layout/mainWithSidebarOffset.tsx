"use client";

import React from "react";
import { useSidebar } from "@/components/ui/sidebarContext";
import DesktopTopNav from "@/components/ui/desktopTopNav";

/**
 * Reserves horizontal space for the fixed desktop sidebar so content is not covered.
 */
export default function MainWithSidebarOffset({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <div
      className={`relative z-10 flex min-h-screen w-full min-w-0 flex-col pt-14 transition-[padding-left] duration-200 ease-in-out ${
        collapsed ? "lg:pl-16" : "lg:pl-64"
      }`}
    >
      <DesktopTopNav />
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
