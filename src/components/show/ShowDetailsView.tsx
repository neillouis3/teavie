"use client";

import React from "react";
import ShowDetailsHero, {
  SHOW_DETAILS_HERO_OVERLAP,
} from "@/components/show/ShowDetailsHero";
import MovieTrailerEmbed from "@/components/movie/MovieTrailerEmbed";
import { SHOW_CONTENT_INSET_X } from "@/lib/contentInset";

type ShowDetailsViewProps = {
  detailsModal: boolean;
  adminPreview: boolean;
  adminBypassActive: boolean;
  hasDetailsHero: boolean;
  detailsBannerUrl: string | null;
  heroAccentColor: string | null;
  title: string;
  titleOverlay: React.ReactNode;
  detailsPanel: React.ReactNode;
  trailerEmbedUrl: string | null;
  canPlay: boolean;
  tmdbShowPremiered: boolean;
  relatedSections: React.ReactNode;
};

export default function ShowDetailsView({
  detailsModal,
  adminPreview,
  adminBypassActive,
  hasDetailsHero,
  detailsBannerUrl,
  heroAccentColor,
  title,
  titleOverlay,
  detailsPanel,
  trailerEmbedUrl,
  canPlay,
  tmdbShowPremiered,
  relatedSections,
}: ShowDetailsViewProps) {
  return (
    <div
      className={`flex w-full flex-col overflow-x-hidden pb-32 ${
        detailsModal ? "bg-transparent" : "bg-background"
      }`}
    >
      {adminPreview && adminBypassActive ? (
        <div
          className={`mb-3 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-center text-xs text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200 ${SHOW_CONTENT_INSET_X}`}
        >
          Admin preview — content policy bypass active
        </div>
      ) : null}
      {hasDetailsHero && detailsBannerUrl ? (
        <ShowDetailsHero
          bannerUrl={detailsBannerUrl}
          accentColor={heroAccentColor}
          title={title}
          overlayContent={titleOverlay}
        />
      ) : null}
      <div
        className={`relative z-10 flex w-full flex-col gap-6 ${SHOW_CONTENT_INSET_X} ${
          hasDetailsHero
            ? SHOW_DETAILS_HERO_OVERLAP
            : "bg-background/92 dark:bg-background/88"
        }`}
      >
        {detailsPanel}
        {trailerEmbedUrl && (canPlay || !tmdbShowPremiered) ? (
          <MovieTrailerEmbed
            variant="details"
            src={trailerEmbedUrl}
            title={`${title} trailer`}
          />
        ) : null}
        {relatedSections}
      </div>
    </div>
  );
}
