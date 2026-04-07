"use client";
import { ReactNode } from "react";
import { useSidebar } from "./sidebarContext";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <>
      <div
        className={`hidden shrink-0 transition-[width] duration-200 ease-in-out lg:fixed lg:left-0 lg:top-0 lg:block lg:h-screen ${
          isCollapsed ? "w-16" : "w-64"
        }`}
        aria-hidden
      />

      <div
        className={`bg-background ml-0 flex min-h-screen w-full flex-1 flex-col items-center transition-[margin-left] duration-200 ease-in-out ${
          isCollapsed ? "lg:ml-16" : "lg:ml-64"
        } lg:w-auto`}
      >
        {children}
      </div>
    </>
  );
}
