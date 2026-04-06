"use client";
import { ReactNode } from "react";
import { motion } from "framer-motion";
import { useSidebar } from "./sidebarContext";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <>
      <motion.div
        initial={false}
        animate={{
          width: isCollapsed ? "4rem" : "16rem",
        }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="hidden lg:block shrink-0 fixed left-0 top-0 h-screen"
        style={{ willChange: "width" }}
      />

      {/* Keep left offset at expanded sidebar width (16rem) so content does not widen when the sidebar collapses */}
      <div className="bg-background ml-0 flex min-h-screen w-full flex-1 flex-col items-center lg:ml-64 lg:w-auto">
        {children}
      </div>
    </>
  );
}
