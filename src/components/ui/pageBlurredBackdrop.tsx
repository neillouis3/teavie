"use client";

import {
  pageBrowseBackdropUrl,
  pageShellBackdropUrl,
  type PageBrowseBackdrop,
  type PageShellBackdrop,
} from "@/lib/pageBackdrop";

type PageBlurredBackdropProps = {
  /** Override shell default; pass for show/episode hero art. */
  imageUrl?: string | null;
  /** Browse /all pages use a separate static asset. */
  variant?: "shell" | PageBrowseBackdrop | PageShellBackdrop;
};

const BACKDROP_IMAGE_CLASS =
  "absolute inset-0 h-full w-full scale-110 object-cover object-[center_25%] blur-2xl brightness-[0.72] saturate-150";

/** Full-viewport frosted backdrop — matches show/episodes pages. */
export default function PageBlurredBackdrop({
  imageUrl,
  variant = "shell",
}: PageBlurredBackdropProps) {
  const staticSrc =
    variant === "shell"
      ? pageShellBackdropUrl("shell")
      : variant === "browse" ||
          variant === "shows" ||
          variant === "movies" ||
          variant === "anime" ||
          variant === "kdrama"
        ? pageBrowseBackdropUrl(variant)
        : pageShellBackdropUrl(variant);
  const src = imageUrl ?? staticSrc;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <img src={src} alt="" className={BACKDROP_IMAGE_CLASS} decoding="async" />
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute left-[18%] top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
      <div className="absolute right-[18%] top-0 h-[28rem] w-[28rem] translate-x-1/2 rounded-full bg-rose-700/10 blur-[120px]" />
    </div>
  );
}
