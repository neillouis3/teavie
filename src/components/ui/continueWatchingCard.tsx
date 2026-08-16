"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardBody } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { tmdbImageUrl } from "@/lib/tmdbImage";
import CatalogCardHoverActions from "@/components/catalog/CatalogCardHoverActions";
import {
  buildCatalogDetailsSeed,
  catalogSeedLinkProps,
} from "@/lib/catalogDetailsSeed";

export type ContinueWatchingCardProps = {
  id: number | string;
  title: string;
  year: string;
  type: "movie" | "tv" | string;
  posterPath?: string;
  backdropPath?: string;
  episodeStillPath?: string | null;
  subtitle: string;
  href: string;
  overview?: string;
  releaseDate?: string;
  onDismiss?: () => void;
};

export default function ContinueWatchingCard({
  id,
  title,
  year,
  type,
  posterPath = "",
  backdropPath = "",
  episodeStillPath = null,
  subtitle,
  href,
  overview,
  releaseDate,
  onDismiss,
}: ContinueWatchingCardProps) {
  const isTv = String(type ?? "").toLowerCase() === "tv";
  const mediaType = isTv ? "tv" : "movie";
  const isExternal = /^https?:\/\//i.test(href);

  const still = String(episodeStillPath ?? "").trim();
  const backdrop = String(backdropPath ?? "").trim();
  const poster = String(posterPath ?? "").trim();
  const src =
    (isTv ? tmdbImageUrl(still) : null) ||
    tmdbImageUrl(backdrop) ||
    tmdbImageUrl(poster) ||
    null;

  const catalogSeed = buildCatalogDetailsSeed({
    title,
    posterPath: poster,
    backdropPath: backdrop || still || poster,
    overview,
    releaseDate,
    year,
  });

  return (
    <div className="group relative min-w-0 w-full">
      <Link
        href={href}
        className="block min-w-0 w-full outline-none"
        aria-label={`${title}. ${subtitle}`}
        {...catalogSeedLinkProps(catalogSeed)}
        {...(isExternal
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
      >
        <Card
          shadow="none"
          radius="lg"
          classNames={{
            base: "border-0 bg-transparent",
          }}
        >
          <CardBody className="relative aspect-video w-full overflow-hidden p-0">
            <div className="absolute inset-0 overflow-hidden rounded-lg">
              <div
                className="absolute inset-0 bg-default-100 dark:bg-default-100/20"
                aria-hidden
              />
              {src ? (
                <Image
                  src={src}
                  alt=""
                  aria-hidden
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 88vw, (max-width: 1024px) 55vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="relative z-[1] flex h-full flex-col items-center justify-center gap-1.5 p-4 text-center">
                  <p className="line-clamp-2 text-sm font-normal text-foreground">
                    {title}
                  </p>
                </div>
              )}
              {src ? (
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[48%] bg-gradient-to-t from-black/82 via-black/35 to-transparent"
                  aria-hidden
                />
              ) : null}
            </div>

            {!isExternal ? (
              <CatalogCardHoverActions
                catalogId={String(id)}
                mediaType={mediaType}
                title={title}
                showWatchLater={onDismiss == null}
              />
            ) : null}

            {src ? (
              <div className="absolute bottom-2 left-2 right-2 z-[2] max-w-[92%] sm:bottom-3 sm:left-3 sm:right-4">
                <p className="text-left text-sm font-normal leading-snug tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)] line-clamp-2 sm:text-[15px]">
                  {title}
                </p>
                <p className="mt-0.5 text-left text-[11px] font-normal leading-snug text-white/75 drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)] line-clamp-2">
                  {subtitle}
                </p>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </Link>
      {onDismiss != null ? (
        <button
          type="button"
          className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
          aria-label={`Remove ${title} from continue watching`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDismiss();
          }}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} className="shrink-0" />
        </button>
      ) : null}
    </div>
  );
}
