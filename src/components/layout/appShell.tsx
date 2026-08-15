"use client";

import React from "react";
import { usePathname } from "next/navigation";
import MainWithSidebarOffset from "@/components/layout/mainWithSidebarOffset";
import { pathUsesAuthShell } from "@/lib/authShellPaths";
import { pathUsesImmersiveWatch } from "@/lib/immersiveWatchPaths";

/** Full-width application shell. Navigation lives in the floating top bar. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathUsesAuthShell(pathname) || pathUsesImmersiveWatch(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="relative z-10 min-h-screen w-full overflow-x-clip lg:overflow-x-visible">
      <MainWithSidebarOffset>{children}</MainWithSidebarOffset>
    </div>
  );
}
