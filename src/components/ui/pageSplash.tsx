"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { teavieLogoForTheme } from "@/lib/brandAssets";

type PageSplashProps = {
  ariaLabel?: string;
};

export default function PageSplash({
  ariaLabel = "Loading page",
}: PageSplashProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const logoSrc = teavieLogoForTheme(resolvedTheme);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={ariaLabel}
    >
      <img
        src={logoSrc}
        alt="Teavie"
        className="h-16 w-auto max-w-[12rem] animate-pulse sm:h-20"
      />
    </div>,
    document.body
  );
}
