"use client";

import React from "react";
import { usePathname } from "next/navigation";
import SideBar from "@/components/ui/sideBar";
import MainWithSidebarOffset from "@/components/layout/mainWithSidebarOffset";
import { pathUsesAuthShell } from "@/lib/authShellPaths";

/**
 * Desktop: sidebar track + main column grid for the full document height.
 * Sidebar is fixed inside the first track; the track reserves horizontal space.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathUsesAuthShell(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="relative z-10 min-h-screen w-full overflow-x-hidden lg:grid lg:grid-cols-[var(--sidebar-w,16rem)_minmax(0,1fr)]">
      <div className="pointer-events-none hidden min-h-screen bg-transparent lg:block" aria-hidden>
        <SideBar />
      </div>
      <div className="min-w-0 overflow-x-hidden lg:overflow-x-visible">
        <MainWithSidebarOffset>{children}</MainWithSidebarOffset>
      </div>
    </div>
  );
}
