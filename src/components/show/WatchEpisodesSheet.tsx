"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { WATCH_CHROME_BLUR_CLASS } from "@/lib/watchChrome";

type WatchEpisodesSheetProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export default function WatchEpisodesSheet({
  open,
  onClose,
  children,
}: WatchEpisodesSheetProps) {
  if (!open) return null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-[110] lg:hidden">
      <button
        type="button"
        aria-label="Close episode list"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[min(75dvh,32rem)] flex-col overflow-hidden rounded-t-2xl pb-[env(safe-area-inset-bottom)]",
          WATCH_CHROME_BLUR_CLASS
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Episodes"
      >
        {children}
      </div>
    </div>
  );
}
