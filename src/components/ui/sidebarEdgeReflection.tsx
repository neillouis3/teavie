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

/**
 * On Explore, tint the sidebar edge from genre tiles currently beside the rail.
 * Elsewhere uses the static violet → orange wash.
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
      const tiles = document.querySelectorAll("[data-genre-glow]");
      if (!tiles.length) {
        setGradient(SIDEBAR_EDGE_GLOW_STATIC);
        return;
      }

      const shell = document.querySelector("[data-sidebar-shell]");
      const sidebarRight = shell?.getBoundingClientRect().width ?? 256;
      let best: { ratio: number; glow: GlowStops } | null = null;

      for (const tile of tiles) {
        const rect = tile.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
        if (rect.left > sidebarRight + 120) continue;

        const glow = readGlow(tile);
        if (!glow) continue;

        const visibleH =
          Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
        const ratio = visibleH / Math.max(rect.height, 1);
        if (!best || ratio > best.ratio) {
          best = { ratio, glow };
        }
      }

      if (best && best.ratio > 0.08) {
        setGradient(
          sidebarEdgeGlowGradient(best.glow.inner, best.glow.outer)
        );
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
      rootMargin: "0px 0px 0px -35%",
      threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
    });

    const watchTiles = () => {
      observer.disconnect();
      document.querySelectorAll("[data-genre-glow]").forEach((el) => {
        observer.observe(el);
      });
      schedule();
    };

    watchTiles();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    const mo = new MutationObserver(watchTiles);
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
