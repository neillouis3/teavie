"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export default function ExplorePageSplash() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const logoSrc =
    mounted && resolvedTheme === "dark" ? "/darkLogo.png" : "/lightLogo.png";

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading Explore"
    >
      <img
        src={logoSrc}
        alt="Teavie"
        className="h-16 w-auto max-w-[12rem] animate-pulse sm:h-20"
      />
      <p className="mt-5 text-sm text-default-500">Loading your catalog…</p>
    </div>
  );
}
