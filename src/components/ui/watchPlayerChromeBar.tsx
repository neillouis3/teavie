"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { WATCH_CHROME_BLUR_CLASS } from "@/lib/watchChrome";

type WatchPlayerChromeBarProps = {
  children: React.ReactNode;
  className?: string;
};

export default function WatchPlayerChromeBar({
  children,
  className,
}: WatchPlayerChromeBarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl py-0 pl-0.5 pr-1.5 sm:gap-4",
        WATCH_CHROME_BLUR_CLASS,
        className
      )}
    >
      {children}
    </div>
  );
}
