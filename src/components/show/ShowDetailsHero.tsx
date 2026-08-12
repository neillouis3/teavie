"use client";

import React from "react";

/** Pull details content up over the bottom of the hero banner (non-modal layout). */
export const SHOW_DETAILS_HERO_OVERLAP =
  "-mt-[164px] sm:-mt-[164px] md:-mt-[164px] lg:-mt-[164px]";

type ShowDetailsHeroProps = {
  bannerUrl: string;
  accentColor?: string | null;
  title: string;
  /**
   * Title / rating / toolbar block (a <CatalogTitleBlock />) overlaid at the
   * bottom of the banner. Pass this for the desktop details-modal look; omit
   * it to keep the original plain banner used on the full page.
   */
  overlayContent?: React.ReactNode;
};

export default function ShowDetailsHero({
  bannerUrl,
  accentColor,
  title,
  overlayContent,
}: ShowDetailsHeroProps) {
  const tint = accentColor?.trim() || null;

  if (overlayContent) {
    return (
      <section
        className="relative z-0 -mt-14 mb-40 w-full shrink-0 overflow-hidden rounded-tl-2xl min-h-[26rem]"
        style={{ height: "calc(56vh + 3.5rem)" }}
        aria-label="Show banner"
      >
        <img
          src={bannerUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover object-[center_25%]"
        />
        {tint ? (
          <div
            className="pointer-events-none absolute inset-0 opacity-20 mix-blend-multiply dark:opacity-25"
            style={{ backgroundColor: tint }}
            aria-hidden
          />
        ) : null}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background from-0% via-background/80 via-30% to-transparent to-75% dark:from-[#101214] dark:via-[#101214]/85"
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-6 sm:px-8 sm:pb-8">
          {overlayContent}
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative z-0 -mt-14 mb-0 w-full shrink-0 overflow-hidden rounded-tl-2xl min-h-[20rem]"
      style={{ height: "calc(40vh + 3.5rem)" }}
      aria-label="Show banner"
    >
      <img
        src={bannerUrl}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-[center_25%]"
      />
      {tint ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-20 mix-blend-multiply dark:opacity-25"
          style={{ backgroundColor: tint }}
          aria-hidden
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background from-0% via-background/45 via-40% to-transparent dark:from-[#101214] dark:via-[#101214]/55"
        aria-hidden
      />
      <span className="sr-only">{title}</span>
    </section>
  );
}