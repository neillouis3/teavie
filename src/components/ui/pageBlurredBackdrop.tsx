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
    "absolute inset-0 h-full w-full scale-110 object-cover object-[center_25%] blur-2xl brightness-[0.72] saturate-150",
  dark: "absolute inset-0 h-full w-full scale-110 object-cover object-[center_25%] blur-2xl brightness-[0.38] saturate-125",
};

function FrostedOverlay({ tone }: { tone: "default" | "dark" }) {
  if (tone === "dark") {
    return (
      <>
        <div className="absolute inset-0 bg-black/65" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/45" />
      </>
    );
  }

  return (
    <>
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute left-[18%] top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
      <div className="absolute right-[18%] top-0 h-[28rem] w-[28rem] translate-x-1/2 rounded-full bg-rose-700/10 blur-[120px]" />
    </>
  );
}

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

function DarkBackdrop() {
  return <div className="absolute inset-0 bg-[#070a08]" />;
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

/** Shell/browse pages use green blob gradients; hero pages use frosted art. */
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
    emptyFallback === "dark" ? <DarkBackdrop /> : <GreenBlobBackdrop />;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#070a08]"
      aria-hidden
    >
      <div className="absolute inset-0">{emptyLayer}</div>
      {displayUrl ? (
        <FrostedArtLayer imageUrl={displayUrl} visible={visible} tone={tone} />
      ) : null}
    </div>
  );
}
