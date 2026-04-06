"use client";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { ThemeSwitcher } from "../themeSwitch";
import { motion, AnimatePresence } from "framer-motion";
import { useSidebar } from "./sidebarContext";
import Link from "next/link";
import { 
  HomeIcon, 
  FilmIcon, 
  MagnifyingGlassIcon,
  TvIcon,
  ChevronLeftIcon,
  ChevronRightIcon 
} from "@heroicons/react/24/outline";
import { Input } from "@heroui/react";

const navItems = [
  { 
    key: "explore", 
    label: "Explore", 
    href: "/explore",
    icon: HomeIcon
  },
  { 
    key: "movies", 
    label: "Movies", 
    href: "/movies/all",
    icon: FilmIcon
  },
  { 
    key: "shows", 
    label: "TV Shows", 
    href: "/shows/all",
    icon: TvIcon
  },
] as const;

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

  // Sync search value with URL params
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    if (pathname === "/search") {
      setSearchValue(q);
    }
  }, [pathname, searchParams]);

  // Keyboard shortcut: Cmd/Ctrl + B
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
      : pathname.startsWith("/movies")
        ? "movies"
        : pathname.startsWith("/shows")
          ? "shows"
          : null;

  return (
    <div
      className={`items-center bg-background z-40 flex flex-col fixed left-0 top-0 h-screen py-4 px-2 hidden lg:flex border-r border-divider transition-[width] duration-200 ease-in-out ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="w-full h-full flex flex-col gap-4">
        {/* Logo and Toggle Button */}
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
              <ChevronRightIcon className="w-5 h-5" />
            ) : (
              <ChevronLeftIcon className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1 flex-1 px-1">
          {navItems.map((item) => {
            const isActive = selectedKey === item.key;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                  ${isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-default-100 text-foreground"
                  }
                  ${isCollapsed ? "justify-center" : ""}
                `}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
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

          {/* Search Input */}
          <AnimatePresence mode="wait">
            {!isCollapsed && (
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
                    startContent={<MagnifyingGlassIcon className="w-4 h-4 text-default-400" />}
                    classNames={{
                      input: "text-sm",
                      inputWrapper: "h-9 bg-default-100 hover:bg-default-200"
                    }}
                  />
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        {/* Theme Switcher at Bottom */}
        <div className={`mt-auto px-1 ${isCollapsed ? "flex justify-center" : ""}`}>
          <ThemeSwitcher collapsed={isCollapsed} />
        </div>
      </div>
    </div>
  );
}
