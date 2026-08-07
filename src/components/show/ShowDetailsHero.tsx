"use client";

import React from "react";

/** Pull details content up over the bottom of the hero banner. */
export const SHOW_DETAILS_HERO_OVERLAP =
  "-mt-[164px] sm:-mt-[164px] md:-mt-[164px] lg:-mt-[164px]";

type ShowDetailsHeroProps = {
  bannerUrl: string;
  accentColor?: string | null;
  title: string;
};

export default function ShowDetailsHero({
  bannerUrl,
  accentColor,
  title,
}: ShowDetailsHeroProps) {
  const tint = accentColor?.trim() || null;

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
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background from-0% via-background/45 via-40% to-transparent"
        aria-hidden
      />
      <span className="sr-only">{title}</span>
    </section>
  );
}
