"use client";

import dynamic from "next/dynamic";

const StremioPlayer = dynamic(() => import("@/components/stremioPlayer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-0 w-full items-center justify-center bg-black">
      <div className="h-8 w-8 animate-pulse rounded-full bg-white/20" aria-hidden />
    </div>
  ),
});

export default StremioPlayer;
