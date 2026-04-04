"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import React from "react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";

export function ThemeSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-default-100 transition-colors"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <MoonIcon className="w-5 h-5 flex-shrink-0" />
      ) : (
        <SunIcon className="w-5 h-5 flex-shrink-0" />
      )}
      {!collapsed && (
        <span className="text-sm font-medium overflow-hidden whitespace-nowrap">
          {isDark ? "Dark" : "Light"}
        </span>
      )}
    </button>
  );
}