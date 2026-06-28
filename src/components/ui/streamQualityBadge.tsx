"use client";

import type { StreamQualityLabel } from "@/lib/streamQuality";

type StreamQualityBadgeProps = {
  quality: StreamQualityLabel;
  className?: string;
};

export default function StreamQualityBadge({
  quality,
  className = "",
}: StreamQualityBadgeProps) {
  const isCam = quality === "cam";

  return (
    <div
      className={`pointer-events-none absolute left-2 top-2 z-10 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide backdrop-blur-sm ${
        isCam
          ? "bg-amber-400/95 text-black"
          : "bg-emerald-600/90 text-white"
      } ${className}`}
      aria-label={isCam ? "CAM quality" : "HD quality"}
    >
      {isCam ? "CAM" : "HD"}
    </div>
  );
}
