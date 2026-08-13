"use client";

import { PAGE_BROWSE_BACKDROP, PAGE_SHELL_BACKDROP } from "@/lib/pageBackdrop";

type PageBlurredBackdropProps = {
  /** Override shell default; pass for show/episode hero art. */
  imageUrl?: string | null;
  /** Browse /all pages use a separate static asset. */
  variant?: "shell" | "browse";
};

/** Full-viewport blurred backdrop — static public asset by default. */
export default function PageBlurredBackdrop({
  imageUrl,
  variant = "shell",
}: PageBlurredBackdropProps) {
  const staticSrc = variant === "browse" ? PAGE_BROWSE_BACKDROP : PAGE_SHELL_BACKDROP;
  const src = imageUrl ?? staticSrc;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <img
        src={src}
        alt=""
        decoding="async"
        fetchPriority="low"
        className="absolute inset-0 h-full w-full scale-105 object-cover object-[center_25%] blur-2xl brightness-[0.72] saturate-150"
      />
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute left-[18%] top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
      <div className="absolute right-[18%] top-0 h-[28rem] w-[28rem] translate-x-1/2 rounded-full bg-rose-700/10 blur-[120px]" />
    </div>
  );
}
