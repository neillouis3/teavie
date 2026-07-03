"use client";
import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { useSidebar } from "./sidebarContext";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { Alert } from "@heroui/react";
import { APP_NAV_SECTIONS } from "@/components/ui/navItems";
import { SIDEBAR_GLASS_CLASS } from "@/components/ui/navGlass";
import { TEAVIE_LOGO, teavieLogoForTheme } from "@/lib/brandAssets";
import VersionChip from "@/components/ui/versionChip";

export default function SideBar() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const logoSrc = mounted ? teavieLogoForTheme(resolvedTheme) : TEAVIE_LOGO.dark;

  const selectedKey =
    pathname.startsWith("/explore")
      ? "explore"
      : pathname.startsWith("/movies")
          ? "movies"
          : pathname.startsWith("/anime")
            ? "anime"
            : pathname.startsWith("/kdrama")
              ? "kdrama"
              : pathname.startsWith("/shows")
                ? "shows"
                : pathname.startsWith("/sports")
                  ? "sports"
                  : null;

  return (
    <div
      data-sidebar-shell
      className={`pointer-events-auto fixed left-0 top-0 z-50 flex hidden h-dvh w-[var(--sidebar-w,16rem)] flex-col items-center py-4 px-2 text-foreground transition-[color,width] duration-200 ease-in-out lg:flex ${SIDEBAR_GLASS_CLASS}`}
    >
      <div className="flex h-full w-full flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-2 min-h-[48px]">
            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <Link href="/explore">
                    <img src={logoSrc} alt="Teavie" className="h-10 w-auto" />
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg transition-colors flex-shrink-0 ml-auto hover:bg-default-100"
              aria-label={isCollapsed ? "Expand sidebar (⌘B)" : "Collapse sidebar (⌘B)"}
              title={isCollapsed ? "Expand sidebar (⌘B)" : "Collapse sidebar (⌘B)"}
            >
              {isCollapsed ? (
                <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="shrink-0" />
              ) : (
                <HugeiconsIcon icon={ArrowLeft01Icon} size={20} className="shrink-0" />
              )}
            </button>
          </div>

          {!isCollapsed ? (
            <div className="px-2">
              <VersionChip />
            </div>
          ) : null}
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1">
          {APP_NAV_SECTIONS.map((section, sectionIndex) => (
            <div
              key={section.id}
              className={`flex flex-col gap-1 ${sectionIndex > 0 ? "mt-4" : ""}`}
            >
              {!isCollapsed && section.title ? (
                <p className="px-3 pb-1 text-sm text-foreground">
                  {section.title}
                </p>
              ) : null}
              {section.items.map((item) => {
                const isActive = selectedKey === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                  ${
                    isActive
                      ? "bg-success text-success-foreground shadow-sm"
                      : "hover:bg-default-100 text-foreground"
                  }
                  ${isCollapsed ? "justify-center" : ""}
                `}
                    title={
                      isCollapsed
                        ? section.title
                          ? `${item.label} · ${section.title}`
                          : item.label
                        : undefined
                    }
                  >
                    <HugeiconsIcon icon={item.icon} size={20} className="shrink-0" />
                    <AnimatePresence mode="wait">
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.15 }}
                          className="text-sm font-medium overflow-hidden whitespace-nowrap"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
                );
              })}
            </div>
          ))}

          {!isCollapsed ? (
            <div className="flex flex-col gap-4 px-0 pt-3">
              <Alert
                color="success"
                variant="flat"
                isDefaultVisible
                hideIcon
                description="Use an ad blocker—third-party players show ads we don’t control."
              />
            </div>
          ) : null}
        </nav>

        {!isCollapsed ? (
          <div className="mt-auto w-full shrink-0 px-1 pb-0">
            <div className="flex w-full justify-end pr-1">
              <img
                src="/nami.png"
                alt=""
                aria-hidden
                className="pointer-events-none h-auto w-3/4 object-contain object-bottom object-right"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
