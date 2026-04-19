'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardBody, Chip } from '@heroui/react';

const metaCornerLeft =
  'pointer-events-none absolute left-2 top-2 z-[3] sm:left-3 sm:top-3';
const metaCornerRight =
  'pointer-events-none absolute right-2 top-2 z-[3] sm:right-3 sm:top-3';

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
 * Wide tile: bare corner dots (no glass wrapper); on card hover they swap instantly
 * to type chip (left) and year pill (right). Coarse pointers always show chips.
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

  const [metaOpen, setMetaOpen] = useState(false);
  const [fineHover, setFineHover] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => setFineHover(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const handleCardEnter = () => {
    if (!fineHover) return;
    setMetaOpen(true);
  };

  const handleCardLeave = () => {
    if (!fineHover) return;
    setMetaOpen(false);
  };

  const showMeta = fineHover ? metaOpen : true;

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
        shadow="none"
        radius="lg"
        classNames={{
          base:
            'border border-default-200/45 bg-default-50/90 transition-colors duration-200 group-hover:border-success/50 dark:border-default-100/15 dark:bg-default-50/10',
        }}
      >
        <CardBody
          className="relative aspect-[16/10] w-full overflow-visible p-0"
          onMouseEnter={src ? handleCardEnter : undefined}
          onMouseLeave={src ? handleCardLeave : undefined}
        >
          <div className="absolute inset-0 overflow-hidden rounded-lg">
            <div className="absolute inset-0 bg-default-100 dark:bg-default-100/20" aria-hidden />
            {src ? (
              <Image
                src={src}
                alt=""
                aria-hidden
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
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

          {src &&
            (showMeta ? (
              <>
                <Chip
                  size="sm"
                  variant="flat"
                  color="success"
                  classNames={{
                    base: `${metaCornerLeft} h-6 min-h-6 bg-success/92 shadow-[0_1px_4px_rgba(0,0,0,0.5)]`,
                    content:
                      'font-normal uppercase tracking-wide text-[10px] text-success-foreground',
                  }}
                  aria-hidden
                >
                  {label}
                </Chip>
                <span
                  className={`${metaCornerRight} rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-normal tabular-nums text-white shadow-[0_1px_4px_rgba(0,0,0,0.5)] ring-1 ring-white/25 dark:bg-black/60`}
                  aria-hidden
                >
                  {year}
                </span>
              </>
            ) : (
              <>
                <span
                  className={`${metaCornerLeft} h-2 w-2 rounded-full bg-success shadow-[0_1px_3px_rgba(0,0,0,0.85)] ring-1 ring-white/50`}
                  aria-hidden
                />
                <span
                  className={`${metaCornerRight} h-2 w-2 rounded-full bg-white/95 shadow-[0_1px_3px_rgba(0,0,0,0.85)] ring-1 ring-black/25`}
                  aria-hidden
                />
              </>
            ))}

          {src && (
            <div className="absolute bottom-2 left-2 right-2 z-[2] max-w-[92%] sm:bottom-3 sm:left-3 sm:right-4">
              {topNote ? (
                <div className="mb-1.5">
                  <Chip
                    size="sm"
                    variant="flat"
                    color="success"
                    classNames={{
                      base: 'h-6 max-w-full bg-success',
                      content:
                        'truncate text-[10px] font-normal uppercase tracking-wide text-success-foreground',
                    }}
                  >
                    {topNote}
                  </Chip>
                </div>
              ) : null}
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
