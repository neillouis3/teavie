"use client";

import { useSyncExternalStore } from "react";
import { applyTvViewportFix, isTvLikeEnvironment } from "@/lib/tvBrowser";

function getTvDesktopSnapshot(): boolean {
  if (typeof document === "undefined") return false;
  applyTvViewportFix();
  return (
    document.documentElement.classList.contains("tv-desktop") ||
    isTvLikeEnvironment()
  );
}

function subscribeTvDesktop(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  window.addEventListener("resize", onStoreChange);
  return () => {
    observer.disconnect();
    window.removeEventListener("resize", onStoreChange);
  };
}

/** True on smart TV / living-room browsers — use desktop chrome, not mobile. */
export function useTvDesktop(): boolean {
  return useSyncExternalStore(
    subscribeTvDesktop,
    getTvDesktopSnapshot,
    () => false
  );
}
