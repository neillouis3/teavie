"use client";

import type { PageBrowseBackdrop, PageShellBackdrop } from "@/lib/pageBackdrop";

type PageBlurredBackdropProps = {
  /** Override shell default; pass for show/episode hero art. */
  imageUrl?: string | null;
  /** Browse /all pages use a separate static asset. */
  variant?: "shell" | PageBrowseBackdrop | PageShellBackdrop;
};

const DYNAMIC_BACKDROP_CLASS =
  "absolute inset-0 h-full w-full scale-110 object-cover object-[center_25%] blur-2xl brightness-[0.72] saturate-150";

function GreenBlobBackdrop() {
  return (
    <>
      <div className="absolute inset-0 bg-[#070a08]" />
      <div className="absolute -left-[12%] top-[-8%] h-[34rem] w-[34rem] rounded-full bg-emerald-500/25 blur-[120px]" />
      <div className="absolute left-[22%] top-[18%] h-[28rem] w-[28rem] rounded-full bg-green-400/15 blur-[100px]" />
      <div className="absolute -right-[10%] top-[4%] h-[32rem] w-[32rem] rounded-full bg-teal-500/20 blur-[120px]" />
      <div className="absolute bottom-[-12%] right-[18%] h-[30rem] w-[30rem] rounded-full bg-lime-500/12 blur-[110px]" />
      <div className="absolute inset-0 bg-black/40" />
    </>
  );
}

/** Shell/browse pages use green blob gradients; hero pages use frosted art. */
export default function PageBlurredBackdrop({
  imageUrl,
  variant: _variant = "shell",
}: PageBlurredBackdropProps) {
  const isShellPage = imageUrl == null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-black"
      aria-hidden
    >
      {isShellPage ? (
        <GreenBlobBackdrop />
      ) : (
        <>
          <img
            src={imageUrl}
            alt=""
            decoding="async"
            fetchPriority="low"
            className={DYNAMIC_BACKDROP_CLASS}
          />
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute left-[18%] top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute right-[18%] top-0 h-[28rem] w-[28rem] translate-x-1/2 rounded-full bg-rose-700/10 blur-[120px]" />
        </>
      )}
    </div>
  );
}
