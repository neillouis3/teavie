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
      {/* Spacer for fixed sidebar */}
      <motion.div
        initial={false}
        animate={{
          width: isCollapsed ? "4rem" : "16rem"
        }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="hidden lg:block shrink-0 fixed left-0 top-0 h-screen"
        style={{
          willChange: "width"
        }}
      />
      
      {/* Main content area */}
      <motion.div
        initial={false}
        animate={{
          marginLeft: isCollapsed ? "4rem" : "16rem"
        }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="bg-background flex flex-col items-center w-full lg:w-auto flex-1 min-h-screen"
        style={{
          willChange: "margin-left"
        }}
      >
        {children}
      </motion.div>
    </>
  );
}
