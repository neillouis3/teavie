"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

function requestFullscreenEl(el: HTMLElement) {
  const anyEl = el as HTMLElement & {
    webkitRequestFullscreen?: () => void;
    msRequestFullscreen?: () => void;
  };
  if (typeof el.requestFullscreen === "function") {
    return el.requestFullscreen();
  }
  if (typeof anyEl.webkitRequestFullscreen === "function") {
    return Promise.resolve(anyEl.webkitRequestFullscreen());
  }
  if (typeof anyEl.msRequestFullscreen === "function") {
    return Promise.resolve(anyEl.msRequestFullscreen());
  }
  return Promise.reject(new Error("Fullscreen not supported"));
}

function exitFullscreenDoc() {
  const doc = document as Document & {
    webkitExitFullscreen?: () => void;
    webkitFullscreenElement?: Element | null;
    msExitFullscreen?: () => void;
  };
  if (doc.fullscreenElement && typeof doc.exitFullscreen === "function") {
    return doc.exitFullscreen();
  }
  if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === "function") {
    return Promise.resolve(doc.webkitExitFullscreen());
  }
  if (typeof doc.msExitFullscreen === "function") {
    return Promise.resolve(doc.msExitFullscreen());
  }
  return Promise.resolve();
}

function isElementFullscreen(el: HTMLElement) {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement === el || doc.webkitFullscreenElement === el;
}

export default function PlayerViewport({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [fs, setFs] = useState(false);

  useEffect(() => {
    const sync = () => {
      const el = rootRef.current;
      setFs(!!el && isElementFullscreen(el));
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const toggle = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (isElementFullscreen(el)) {
      void exitFullscreenDoc();
    } else {
      void requestFullscreenEl(el).catch(() => {});
    }
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative h-full w-full min-h-0 bg-black ${className}`.trim()}
    >
      {children}
      <button
        type="button"
        onClick={toggle}
        className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-md bg-black/70 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        aria-label={fs ? "Exit fullscreen" : "Enter fullscreen"}
      >
        {fs ? (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-4"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M3.22 3.22a.75.75 0 011.06 0L9 7.94V6a.75.75 0 011.5 0v4.5A.75.75 0 019 11.25H4.5a.75.75 0 010-1.5h1.94L3.22 4.28a.75.75 0 010-1.06zm9.53 0a.75.75 0 011.06 0l3.22 3.22H18A.75.75 0 0118 9h-4.5a.75.75 0 01-.75-.75V4.5a.75.75 0 011.5 0v1.94l3.22-3.22a.75.75 0 011.06 0zM3.22 18.78a.75.75 0 010-1.06L6.44 14.5H4.5a.75.75 0 010-1.5H9a.75.75 0 01.75.75V18a.75.75 0 01-1.5 0v-1.94l-3.22 3.22a.75.75 0 01-1.06 0zM14.78 14.5l3.22 3.22a.75.75 0 01-1.06 1.06L13.72 15.5H15a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75V11a.75.75 0 011.5 0v1.94l3.22-3.22a.75.75 0 011.06 1.06z"
                clipRule="evenodd"
              />
            </svg>
            Exit
          </>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-4"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M15 3.75A.75.75 0 0115.75 3h4.5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0V5.56l-3.22 3.22a.75.75 0 11-1.06-1.06l3.22-3.22h-2.69a.75.75 0 010-1.5zm-6 0a.75.75 0 01-.75.75H5.56l3.22 3.22a.75.75 0 11-1.06 1.06L4.5 5.56v2.69a.75.75 0 01-1.5 0v-4.5A.75.75 0 013.75 3h4.5a.75.75 0 010 1.5zM9.75 18a.75.75 0 01.75-.75h2.69l-3.22-3.22a.75.75 0 111.06-1.06l3.22 3.22v-2.69a.75.75 0 011.5 0v4.5a.75.75 0 01-.75.75h-4.5a.75.75 0 010-1.5zm-6 0a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-4.5a.75.75 0 011.5 0v2.69l3.22-3.22a.75.75 0 111.06 1.06L5.56 18h2.69a.75.75 0 010 1.5h-4.5z"
                clipRule="evenodd"
              />
            </svg>
            Fullscreen
          </>
        )}
      </button>
    </div>
  );
}
