"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SidebarContextType {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const saved = document.cookie
      .split("; ")
      .find((row) => row.startsWith("sidebar_state="))
      ?.split("=")[1];
    if (saved) setOpen(saved === "true");
  }, []);

  const toggleSidebar = () => {
    setOpen((prev) => {
      const newState = !prev;
      document.cookie = `sidebar_state=${newState}; path=/; max-age=${60 * 60 * 24 * 7}`;
      return newState;
    });
  };

  const state = open ? "expanded" : "collapsed";

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-w",
      state === "collapsed" ? "4rem" : "16rem"
    );
  }, [state]);

  return (
    <SidebarContext.Provider value={{ state, open, setOpen, isMobile, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
