"use client";

import React from "react";
import { useSidebar } from "@/components/ui/sidebarContext";
import SideBar from "@/components/ui/sideBar";
import MainWithSidebarOffset from "@/components/layout/mainWithSidebarOffset";

/**
 * Desktop: sidebar track + main column grid for the full document height.
 * Sidebar is fixed inside the first track; the track reserves horizontal space.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <div
      className={`relative z-10 min-h-screen w-full lg:grid lg:transition-[grid-template-columns] duration-200 ease-in-out ${
        collapsed
          ? "lg:grid-cols-[4rem_minmax(0,1fr)]"
          : "lg:grid-cols-[16rem_minmax(0,1fr)]"
      }`}
    >
      <div className="hidden min-h-screen lg:block" aria-hidden>
        <SideBar />
      </div>
      <div className="min-w-0 overflow-x-hidden lg:overflow-x-visible">
        <MainWithSidebarOffset>{children}</MainWithSidebarOffset>
      </div>
    </div>
  );
}
