"use client";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { useSidebar } from "./sidebarContext";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { Input, Alert, Tooltip } from "@heroui/react";
import { APP_NAV_SECTIONS } from "@/components/ui/navItems";

export default function SideBar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    if (pathname === "/search") {
      setSearchValue(q);
    }
  }, [pathname, searchParams]);

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

  const logoSrc = mounted && resolvedTheme === "dark" ? "/darkLogo.png" : "/lightLogo.png";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchValue.trim();
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/search");
    }
  };

  const selectedKey =
    pathname.startsWith("/explore")
      ? "explore"
      : pathname.startsWith("/discover")
        ? "discover"
        : pathname.startsWith("/movies")
          ? "movies"
          : pathname.startsWith("/anime")
            ? "anime"
            : pathname.startsWith("/shows")
              ? "shows"
              : pathname.startsWith("/sports")
                ? "sports"
                : null;

  const settingsActive = pathname.startsWith("/settings");

  return (
    <div
      className={`items-center bg-background z-40 flex flex-col fixed left-0 top-0 h-screen py-4 px-2 hidden lg:flex border-r border-divider transition-[width] duration-200 ease-in-out ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="w-full h-full flex flex-col gap-4">
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
                <img src={logoSrc} alt="TeaVie" className="h-12 w-auto" />
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-default-100 transition-colors flex-shrink-0 ml-auto"
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

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1">
          {APP_NAV_SECTIONS.map((section, sectionIndex) => (
            <div
              key={section.id}
              className={`flex flex-col gap-1 ${sectionIndex > 0 ? "mt-4" : ""}`}
            >
              {!isCollapsed && section.title ? (
                <p className="px-3 pb-1 text-sm text-foreground">{section.title}</p>
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

          {isCollapsed ? (
            <Tooltip placement="right" content="Search">
              <Link
                href="/search"
                className={`
                  mt-1 flex items-center justify-center rounded-lg px-3 py-2.5 transition-all
                  ${
                    pathname.startsWith("/search")
                      ? "bg-success text-success-foreground shadow-sm"
                      : "text-foreground hover:bg-default-100"
                  }
                `}
                aria-label="Search"
              >
                <HugeiconsIcon icon={Search01Icon} size={20} className="shrink-0" />
              </Link>
            </Tooltip>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="px-1 pt-2"
              >
                <form onSubmit={handleSearch}>
                  <Input
                    size="sm"
                    variant="flat"
                    placeholder="Search..."
                    value={searchValue}
                    onValueChange={setSearchValue}
                    startContent={
                      <HugeiconsIcon
                        icon={Search01Icon}
                        size={16}
                        className="shrink-0 text-default-400"
                      />
                    }
                    classNames={{
                      input: "text-sm",
                      inputWrapper: "h-9 bg-default-100 hover:bg-default-200",
                    }}
                  />
                </form>
              </motion.div>
            </AnimatePresence>
          )}

          {!isCollapsed ? (
            <div className="flex flex-col gap-4 px-0 pt-3">
              <Alert
                color="success"
                variant="flat"
                isDefaultVisible
                hideIcon
                description="Use an ad blocker—third-party players show ads we don’t control."
              />
              <Link
                href="/settings"
                className={`
                  flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-all
                  ${
                    settingsActive
                      ? "bg-success text-success-foreground shadow-sm"
                      : "text-foreground hover:bg-default-100"
                  }
                `}
              >
                <HugeiconsIcon icon={Settings01Icon} size={20} className="shrink-0" />
                <span className="text-sm font-medium">Settings</span>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 px-1 pt-3">
              <Tooltip
                placement="right"
                content="Use an ad blocker—third-party players show ads we don’t control."
                classNames={{ content: "max-w-[220px] text-tiny" }}
              >
                <span className="cursor-default text-center text-[10px] font-medium leading-tight text-success">
                  Adblock
                </span>
              </Tooltip>
              <Tooltip placement="right" content="Settings">
                <Link
                  href="/settings"
                  className={`
                    flex items-center justify-center rounded-lg p-2.5 transition-all
                    ${
                      settingsActive
                        ? "bg-success text-success-foreground shadow-sm"
                        : "text-foreground hover:bg-default-100"
                    }
                  `}
                  aria-label="Settings"
                >
                  <HugeiconsIcon icon={Settings01Icon} size={20} className="shrink-0" />
                </Link>
              </Tooltip>
            </div>
          )}
        </nav>

        <div className="mt-auto w-full shrink-0 px-1 pb-0">
          <div className={`flex w-full ${isCollapsed ? "justify-end pr-0.5" : "justify-end pr-1"}`}>
            <img
              src="/nami.png"
              alt=""
              aria-hidden
              className="pointer-events-none h-auto w-3/4 object-contain object-bottom object-right"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
