'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardBody, Chip } from '@heroui/react';

export type HorizontalCatalogCardProps = {
  id: number | string;
  title: string;
  year: string;
  type: 'movie' | 'tv' | string;
  posterPath?: string;
  backdropPath?: string;
  /** Small label above title (e.g. Sequel, Prequel) */
  topNote?: string;
  /** When set (e.g. external AniList URL), used instead of `/shows/` or `/movies/` */
  href?: string;
};

const BASE = 'https://image.tmdb.org/t/p/';
const BACKDROP_SIZE = 'w1280';
const POSTER_SIZE = 'w500';

/**
 * Wide tile: backdrop/poster and title on bottom overlay (no corner meta pills).
 */
export default function HorizontalCatalogCard({
  id,
  title,
  year,
  type,
  posterPath = '',
  backdropPath = '',
  href: hrefProp,
}: HorizontalCatalogCardProps) {
  const typeLower = String(type ?? '').toLowerCase();
  const isTv = typeLower === 'tv';
  const href =
    hrefProp?.trim() ||
    (isTv ? `/shows/${id}` : `/movies/${id}`);
  const isExternal = /^https?:\/\//i.test(href);
  const label = isExternal ? 'WEB' : isTv ? 'TV' : 'MOVIE';

  const backdrop = backdropPath?.trim();
  const poster = posterPath?.trim();
  const src = backdrop
    ? /^https?:\/\//i.test(backdrop)
      ? backdrop
      : `${BASE}${BACKDROP_SIZE}${backdrop}`
    : poster
      ? /^https?:\/\//i.test(poster)
        ? poster
        : `${BASE}${POSTER_SIZE}${poster}`
      : null;

  return (
    <Link
      href={href}
      className="block min-w-0 w-full outline-none"
      aria-label={`${title}, ${label}, ${year}`}
      {...(isExternal
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      <Card
        shadow="none"
        radius="lg"
        classNames={{
          base:
            'border border-default-200/45 bg-default-50/90 dark:border-default-100/15 dark:bg-default-50/10',
        }}
      >
        <CardBody className="relative aspect-[16/10] w-full overflow-hidden p-0">
          <div className="absolute inset-0 overflow-hidden rounded-lg">
            <div className="absolute inset-0 bg-default-100 dark:bg-default-100/20" aria-hidden />
            {src ? (
              <Image
                src={src}
                alt=""
                aria-hidden
                fill
                unoptimized
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-cover"
              />
            ) : (
              <div className="relative z-[1] flex h-full flex-col items-center justify-center gap-1.5 p-4 text-center">
                <p className="line-clamp-2 text-sm font-normal text-foreground">{title}</p>
                <Chip size="sm" variant="flat" color="success">
                  No image
                </Chip>
              </div>
            )}
            {src && (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[48%] bg-gradient-to-t from-black/82 via-black/35 to-transparent"
                aria-hidden
              />
            )}
          </div>

          {src && (
            <div className="absolute bottom-2 left-2 right-2 z-[2] max-w-[92%] sm:bottom-3 sm:left-3 sm:right-4">
              <p className="text-left text-sm font-normal leading-snug tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)] line-clamp-2 sm:text-[15px]">
                {title}
              </p>
            </div>
          )}
        </CardBody>
      </Card>
    </Link>
  );
}
