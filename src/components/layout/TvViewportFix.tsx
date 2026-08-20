"use client";

import { useEffect } from "react";
import { applyTvViewportFix } from "@/lib/tvBrowser";

/** Client fallback if the beforeInteractive viewport script did not run. */
export default function TvViewportFix() {
  useEffect(() => {
    applyTvViewportFix();
  }, []);

  return null;
}
