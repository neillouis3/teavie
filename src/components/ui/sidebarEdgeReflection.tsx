"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  SIDEBAR_EDGE_GLOW_STATIC,
  sidebarEdgeGlowGradient,
} from "@/lib/sidebarEdgeGlow";

type GlowStops = { inner: string; outer: string };

function readGlow(el: Element): GlowStops | null {
  const inner = el.getAttribute("data-glow-inner");
  const outer = el.getAttribute("data-glow-outer");
  if (!inner || !outer) return null;
  return { inner, outer };
}

/** Pixels of content strip immediately beside the sidebar edge. */
function adjacentScore(el: Element, sidebarRight: number): number {
  const rect = el.getBoundingClientRect();
  const stripRight = sidebarRight + 96;
  const overlapX =
    Math.min(rect.right, stripRight) - Math.max(rect.left, sidebarRight - 8);
  const overlapY =
    Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
  if (overlapX <= 0 || overlapY <= 0) return 0;

  const priority = Number(el.getAttribute("data-glow-priority") ?? "1");
  return overlapX * overlapY * priority;
}

/**
 * On Explore, tint the sidebar edge from content in the strip beside the rail
 * (spotlight hero prioritized over genre tiles). Elsewhere uses static wash.
 */
export function useSidebarEdgeGlow(): string {
  const pathname = usePathname();
  const onExplore = pathname.startsWith("/explore");
  const [gradient, setGradient] = useState(SIDEBAR_EDGE_GLOW_STATIC);

  useEffect(() => {
    if (!onExplore) {
      setGradient(SIDEBAR_EDGE_GLOW_STATIC);
      return;
    }

    let raf = 0;

    const pickGlow = () => {
      const sources = document.querySelectorAll("[data-sidebar-glow]");
      if (!sources.length) {
        setGradient(SIDEBAR_EDGE_GLOW_STATIC);
        return;
      }

      const shell = document.querySelector("[data-sidebar-shell]");
      const sidebarRight = shell?.getBoundingClientRect().width ?? 256;
      let best: { score: number; glow: GlowStops } | null = null;

      for (const el of sources) {
        const score = adjacentScore(el, sidebarRight);
        if (score <= 0) continue;

        const glow = readGlow(el);
        if (!glow) continue;

        if (!best || score > best.score) {
          best = { score, glow };
        }
      }

      const minScore = window.innerHeight * 48;
      if (best && best.score > minScore) {
        setGradient(sidebarEdgeGlowGradient(best.glow.inner, best.glow.outer));
      } else {
        setGradient(SIDEBAR_EDGE_GLOW_STATIC);
      }
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(pickGlow);
    };

    const observer = new IntersectionObserver(schedule, {
      root: null,
      rootMargin: "0px 0px 0px -30%",
      threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
    });

    const watchSources = () => {
      observer.disconnect();
      document.querySelectorAll("[data-sidebar-glow]").forEach((el) => {
        observer.observe(el);
      });
      schedule();
    };

    watchSources();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    const mo = new MutationObserver(watchSources);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      mo.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [onExplore]);

  return gradient;
}

export default function SidebarEdgeReflection() {
  const background = useSidebarEdgeGlow();

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 transition-[background] duration-700 ease-out"
      style={{ background }}
      aria-hidden
    />
  );
}
