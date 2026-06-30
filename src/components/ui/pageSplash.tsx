"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TEAVIE_LOGO } from "@/lib/brandAssets";

type PageSplashProps = {
  ariaLabel?: string;
};

export default function PageSplash({
  ariaLabel = "Loading page",
}: PageSplashProps) {
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
        src={TEAVIE_LOGO.icon}
        alt="Teavie"
        className="h-16 w-16 animate-pulse sm:h-20 sm:w-20"
      />
    </div>,
    document.body
  );
}
