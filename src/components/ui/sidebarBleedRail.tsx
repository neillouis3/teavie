"use client";

import React, { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { CarouselItem } from "@/components/ui/carousel";

type SidebarBleedRailProps = {
  children: React.ReactNode;
  className?: string;
  /** Native horizontal scroll (e.g. grid rails) instead of Embla. */
  scrollable?: boolean;
};

const LG_MEDIA = "(min-width: 1024px)";

function subscribeLgUp(onStoreChange: () => void) {
  const mq = window.matchMedia(LG_MEDIA);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getLgUpSnapshot() {
  return window.matchMedia(LG_MEDIA).matches;
}

/** True when the fixed sidebar layout is active (lg+). */
export function useSidebarBleedOffset() {
  return useSyncExternalStore(subscribeLgUp, getLgUpSnapshot, () => false);
}

/** Keep sidebar-dependent layout in sync during collapse/expand. */
export const SIDEBAR_SYNC_TRANSITION =
  "lg:transition-[left,margin-left,padding-left,width,basis] lg:duration-200 lg:ease-in-out";

/** Full viewport width under the fixed sidebar (desktop). */
export const SIDEBAR_BLEED_SHELL =
  `w-full lg:ml-[calc(-1*var(--sidebar-w,16rem))] lg:w-screen lg:max-w-none ${SIDEBAR_SYNC_TRANSITION}`;

/** Explore spotlight: gapless full-width slides. */
export const SPOTLIGHT_SLIDE_CLASS =
  "h-full !basis-full !pl-0";

/** Explore spotlight: embla track (no default pl-3 gutter). */
export const SPOTLIGHT_TRACK_CLASS = "!ml-0 h-full";

/** Explore spotlight shell: content column + sidebar = full viewport width. */
export const SPOTLIGHT_SHELL_WIDTH =
  `lg:w-[calc(100%+var(--sidebar-w,16rem))] lg:max-w-none ${SIDEBAR_SYNC_TRANSITION}`;

/** Inline full-bleed shell (sidebar → viewport left). Prefer over Tailwind arbitrary bleed classes. */
export function sidebarBleedShellStyle(active: boolean): React.CSSProperties {
  if (!active) return {};
  return {
    marginLeft: "calc(-1 * var(--sidebar-w, 16rem))",
    width: "100vw",
    maxWidth: "none",
  };
}

const HERO_COVER_IMG_CLASS =
  "h-full w-full min-h-full min-w-full max-w-none object-cover object-center";

/** @deprecated Use {@link HeroBleedCoverImage}. */
export const HERO_COVER_IMAGE_CLASS =
  `absolute inset-0 ${HERO_COVER_IMG_CLASS}`;

/** @deprecated Use {@link HeroBleedCoverImage}. */
export const SPOTLIGHT_IMAGE_CLASS = HERO_COVER_IMAGE_CLASS;

type HeroBleedCoverImageProps = {
  src: string;
  alt: string;
  sizes?: string;
  /** When true (desktop), crop centers on the content column, not the viewport. */
  alignToContentColumn?: boolean;
  imgClassName?: string;
  className?: string;
};

/**
 * Full-bleed hero image: fills edge-to-edge (no sidebar gap) while centering the
 * crop on the main content column via a slightly wider inner frame + object-center.
 */
export function HeroBleedCoverImage({
  src,
  alt,
  sizes,
  alignToContentColumn = true,
  imgClassName,
  className,
}: HeroBleedCoverImageProps) {
  const sidebarBleed = useSidebarBleedOffset();
  const useColumnFrame = alignToContentColumn && sidebarBleed;

  if (!useColumnFrame) {
    return (
      <img
        src={src}
        alt={alt}
        sizes={sizes}
        aria-hidden={alt === "" ? true : undefined}
        className={cn(
          "absolute inset-0",
          HERO_COVER_IMG_CLASS,
          imgClassName,
          className
        )}
      />
    );
  }

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <div
        className={cn("absolute inset-y-0 left-0", SIDEBAR_SYNC_TRANSITION)}
        style={{ width: "calc(100% + var(--sidebar-w))" }}
      >
        <img
          src={src}
          alt={alt}
          sizes={sizes}
          aria-hidden={alt === "" ? true : undefined}
          className={cn(HERO_COVER_IMG_CLASS, imgClassName)}
        />
      </div>
    </div>
  );
}

/** @deprecated Use {@link HeroBleedCoverImage}. */
export function heroContentColumnObjectStyle(
  active: boolean
): React.CSSProperties {
  if (!active) {
    return { objectPosition: "center center" };
  }
  return {
    objectPosition: "calc(50% + var(--sidebar-w) / 2) center",
  };
}

/** Overlay / controls aligned to the main content column. */
export const SPOTLIGHT_CONTENT_INSET =
  `pl-4 lg:pl-[calc(var(--sidebar-w,16rem)+1rem)] ${SIDEBAR_SYNC_TRANSITION}`;

export const SPOTLIGHT_ARROW_PREV =
  `left-4 lg:left-[calc(var(--sidebar-w,16rem)+1rem)] ${SIDEBAR_SYNC_TRANSITION}`;

export const SPOTLIGHT_ARROW_NEXT =
  "right-4";

export const SIDEBAR_BLEED_CAROUSEL_OPTS = {
  align: "start" as const,
  dragFree: true,
};

const SCROLL_HIDE =
  "overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Embla viewport: full-bleed shell; first slide is the sidebar-width offset. */
export function sidebarBleedViewportClass(
  ...extra: (string | false | null | undefined)[]
) {
  return cn(SIDEBAR_BLEED_SHELL, extra);
}

/** Catalog rail viewport — full-bleed on Explore, contained width on detail pages. */
export function catalogRailViewportClass(
  bleed = true,
  ...extra: (string | false | null | undefined)[]
) {
  return bleed
    ? sidebarBleedViewportClass(...extra)
    : cn("w-full overflow-hidden", ...extra);
}

export function CatalogRailShell({
  bleed = true,
  children,
}: {
  bleed?: boolean;
  children: React.ReactNode;
}) {
  if (!bleed) return <>{children}</>;
  return <SidebarBleedRail>{children}</SidebarBleedRail>;
}

/** Embla viewport: 100vw under the sidebar (Explore spotlight). */
export const SPOTLIGHT_VIEWPORT_CLASS = sidebarBleedViewportClass("h-full");

/** Desktop-only leading slide matching the sidebar width. */
export function SidebarBleedStartSpacer() {
  const show = useSidebarBleedOffset();
  if (!show) return null;

  return (
    <CarouselItem
      aria-hidden
      className="shrink-0 grow-0 basis-[var(--sidebar-w,16rem)] pl-0 lg:transition-[basis,width] lg:duration-200 lg:ease-in-out"
    >
      <span className="sr-only">Sidebar offset</span>
    </CarouselItem>
  );
}

/** Desktop-only leading gap for native horizontal scroll tracks. */
export function SidebarBleedNativeStart() {
  const show = useSidebarBleedOffset();
  if (!show) return null;

  return (
    <div
      className="shrink-0 w-[var(--sidebar-w,16rem)]"
      aria-hidden
    />
  );
}

export default function SidebarBleedRail({
  children,
  className,
  scrollable = false,
}: SidebarBleedRailProps) {
  if (!scrollable) {
    return <>{children}</>;
  }

  return (
    <div className={cn(SIDEBAR_BLEED_SHELL, SCROLL_HIDE, className)}>
      {children}
    </div>
  );
}
