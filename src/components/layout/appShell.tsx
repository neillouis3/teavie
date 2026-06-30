"use client";

import React from "react";
import { useSidebar } from "@/components/ui/sidebarContext";
import SideBar from "@/components/ui/sideBar";
import MainWithSidebarOffset from "@/components/layout/mainWithSidebarOffset";

/**
 * Desktop: sidebar + main as grid columns for the full document height.
 * Mobile: main column only (sidebar is in the drawer).
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
      <SideBar />
      <MainWithSidebarOffset>{children}</MainWithSidebarOffset>
    </div>
  );
}
