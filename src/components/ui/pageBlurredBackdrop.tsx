"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { PageBrowseBackdrop, PageShellBackdrop } from "@/lib/pageBackdrop";

type PageBlurredBackdropProps = {
  /** Override shell default; pass for show/episode hero art. */
  imageUrl?: string | null;
  /** Browse /all pages use a separate static asset. */
  variant?: "shell" | PageBrowseBackdrop | PageShellBackdrop;
  /** Backdrop when `imageUrl` is missing or still preloading. */
  emptyFallback?: "shell" | "dark";
  /** Heavier dimming for profile-style pages. */
  tone?: "default" | "dark";
};

const DYNAMIC_BACKDROP_CLASS = {
  default:
    "absolute inset-0 h-full w-full scale-110 object-cover object-[center_25%] blur-3xl opacity-90 brightness-[1.12] saturate-[0.22] dark:blur-2xl dark:opacity-100 dark:brightness-[0.72] dark:saturate-150",
  dark: "absolute inset-0 h-full w-full scale-110 object-cover object-[center_25%] blur-3xl opacity-95 brightness-[1.05] saturate-[0.28] dark:blur-2xl dark:opacity-100 dark:brightness-[0.38] dark:saturate-125",
};

function FrostedOverlay({ tone }: { tone: "default" | "dark" }) {
  if (tone === "dark") {
    return (
      <>
        <div className="absolute inset-0 bg-white/84 dark:bg-black/65" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/55 via-white/25 to-background dark:from-black/20 dark:via-transparent dark:to-black/45" />
      </>
    );
  }

  return (
    <>
      <div className="absolute inset-0 bg-white/76 dark:bg-black/35" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/45 via-white/20 to-background dark:from-transparent dark:via-transparent dark:to-transparent" />
      <div className="absolute left-[18%] top-0 hidden h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px] dark:block" />
      <div className="absolute right-[18%] top-0 hidden h-[28rem] w-[28rem] translate-x-1/2 rounded-full bg-rose-700/10 blur-[120px] dark:block" />
    </>
  );
}

function ShellBlobBackdrop() {
  return (
    <>
      <div className="absolute inset-0 bg-background" />
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 80% 55% at 50% -15%, rgba(148, 163, 184, 0.16), transparent 68%)",
            "radial-gradient(ellipse 55% 45% at 0% 35%, rgba(226, 232, 240, 0.55), transparent 72%)",
            "radial-gradient(ellipse 50% 40% at 100% 20%, rgba(241, 245, 249, 0.65), transparent 70%)",
          ].join(", "),
        }}
      />
      <div className="absolute -left-[12%] top-[-8%] hidden h-[34rem] w-[34rem] rounded-full bg-emerald-500/25 blur-[120px] dark:block" />
      <div className="absolute left-[22%] top-[18%] hidden h-[28rem] w-[28rem] rounded-full bg-green-400/15 blur-[100px] dark:block" />
      <div className="absolute -right-[10%] top-[4%] hidden h-[32rem] w-[32rem] rounded-full bg-teal-500/20 blur-[120px] dark:block" />
      <div className="absolute bottom-[-12%] right-[18%] hidden h-[30rem] w-[30rem] rounded-full bg-lime-500/12 blur-[110px] dark:block" />
      <div className="absolute inset-0 hidden bg-black/40 dark:block" />
    </>
  );
}

function DarkBackdrop() {
  return (
    <>
      <div className="absolute inset-0 bg-background" />
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(226, 232, 240, 0.45), transparent 72%)",
        }}
      />
      <div className="absolute inset-0 hidden bg-[#070a08] dark:block" />
    </>
  );
}

function FrostedArtLayer({
  imageUrl,
  visible,
  tone,
}: {
  imageUrl: string;
  visible: boolean;
  tone: "default" | "dark";
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 transition-opacity duration-700 ease-out",
        visible ? "opacity-100" : "opacity-0"
      )}
    >
      <img
        src={imageUrl}
        alt=""
        decoding="async"
        fetchPriority="low"
        className={DYNAMIC_BACKDROP_CLASS[tone]}
      />
      <FrostedOverlay tone={tone} />
    </div>
  );
}

/** Shell/browse pages use soft blobs; hero pages use frosted art. */
export default function PageBlurredBackdrop({
  imageUrl,
  variant: _variant = "shell",
  emptyFallback = "shell",
  tone = "default",
}: PageBlurredBackdropProps) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const loadedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const next = imageUrl?.trim() || null;

    if (!next) {
      loadedUrlRef.current = null;
      setVisible(false);
      const timer = window.setTimeout(() => setDisplayUrl(null), 700);
      return () => window.clearTimeout(timer);
    }

    if (loadedUrlRef.current === next) {
      setDisplayUrl(next);
      setVisible(true);
      return;
    }

    let cancelled = false;
    setVisible(false);

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      loadedUrlRef.current = next;
      setDisplayUrl(next);
      requestAnimationFrame(() => {
        if (!cancelled) setVisible(true);
      });
    };
    img.onerror = () => {
      if (cancelled) return;
      loadedUrlRef.current = null;
      setDisplayUrl(null);
      setVisible(false);
    };
    img.src = next;

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const emptyLayer =
    emptyFallback === "dark" ? <DarkBackdrop /> : <ShellBlobBackdrop />;
  const heroActive = Boolean(displayUrl && visible);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-background"
      aria-hidden
    >
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-700 ease-out",
          heroActive ? "opacity-0" : "opacity-100"
        )}
      >
        {emptyLayer}
      </div>
      {displayUrl ? (
        <FrostedArtLayer imageUrl={displayUrl} visible={visible} tone={tone} />
      ) : null}
    </div>
  );
}
