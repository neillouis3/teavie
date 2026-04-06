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
      {/* Spacer for fixed sidebar — plain div + CSS transition (no transform) so iframe fullscreen works */}
      <div
        className={`hidden lg:block shrink-0 fixed left-0 top-0 h-screen transition-[width] duration-200 ease-in-out ${
          isCollapsed ? "w-16" : "w-64"
        }`}
        aria-hidden
      />

      <div
        className={`bg-background flex flex-col items-center w-full lg:w-auto flex-1 min-h-screen transition-[margin-left] duration-200 ease-in-out ml-0 ${
          isCollapsed ? "lg:ml-16" : "lg:ml-64"
        }`}
      >
        {children}
      </div>
    </>
  );
}
