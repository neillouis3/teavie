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
 * Wide tile: backdrop/poster, HeroUI chips, title on bottom overlay.
 */
export default function HorizontalCatalogCard({
  id,
  title,
  year,
  type,
  posterPath = '',
  backdropPath = '',
  topNote,
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
      className="group block min-w-0 w-full outline-none"
      aria-label={`${title}, ${label}, ${year}`}
      {...(isExternal
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      <Card
        shadow="sm"
        radius="lg"
        classNames={{
          base:
            'border border-default-200/80 bg-content1 transition-all duration-300 group-hover:border-success/55 group-hover:shadow-md group-hover:shadow-success/15 dark:border-default-100/25',
        }}
      >
        <CardBody className="relative aspect-[16/10] w-full overflow-hidden p-0">
          <div className="absolute inset-0 bg-default-200" aria-hidden />
          {src ? (
            <Image
              src={src}
              alt=""
              aria-hidden
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <div className="relative z-[1] flex h-full flex-col items-center justify-center gap-1.5 p-4 text-center">
              <p className="line-clamp-2 text-sm font-medium text-foreground">{title}</p>
              <Chip size="sm" variant="flat" color="success">
                No image
              </Chip>
            </div>
          )}
          {src && (
            <>
              <div
                className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/75 via-black/25 to-black/10"
                aria-hidden
              />
              <div className="absolute left-2 top-2 z-[2] flex flex-wrap items-center gap-1.5 sm:left-3 sm:top-3">
                <Chip
                  size="sm"
                  variant="flat"
                  color="success"
                  classNames={{
                    base: 'backdrop-blur-md bg-success/90 border border-success-400/30 shadow-sm',
                    content: 'font-semibold uppercase tracking-wide text-[10px] text-success-foreground',
                  }}
                >
                  {label}
                </Chip>
              </div>
              <div className="absolute right-2 top-2 z-[2] sm:right-3 sm:top-3">
                <Chip
                  size="sm"
                  variant="bordered"
                  color="success"
                  classNames={{
                    base: 'border-success-400/60 bg-black/35 backdrop-blur-md shadow-sm',
                    content: 'text-[10px] font-semibold tabular-nums text-white',
                  }}
                >
                  {year}
                </Chip>
              </div>
              <div className="absolute bottom-2 left-2 right-2 z-[2] max-w-[92%] sm:bottom-3 sm:left-3 sm:right-4">
                {topNote ? (
                  <div className="mb-1.5">
                    <Chip
                      size="sm"
                      variant="solid"
                      color="success"
                      classNames={{
                        base: 'h-6 max-w-full shadow-md',
                        content:
                          'truncate text-[10px] font-bold uppercase tracking-wide text-success-foreground',
                      }}
                    >
                      {topNote}
                    </Chip>
                  </div>
                ) : null}
                <p className="text-left text-sm font-semibold leading-snug tracking-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] line-clamp-2 sm:text-[15px]">
                  {title}
                </p>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </Link>
  );
}
