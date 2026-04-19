'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardBody, Chip } from '@heroui/react';

const CATALOG_META_HOVER_MS = 520;

type MetaPillSide = 'left' | 'right';

function CatalogMetaPill({
  side,
  open,
  label,
  yearLabel,
}: {
  side: MetaPillSide;
  open: boolean;
  label: string;
  yearLabel: string;
}) {
  const expanded =
    side === 'left' ? (
      <Chip
        size="sm"
        variant="flat"
        color="success"
        classNames={{
          base: 'h-6 min-h-6 bg-success/92',
          content:
            'font-normal uppercase tracking-wide text-[10px] text-success-foreground',
        }}
      >
        {label}
      </Chip>
    ) : (
      <span className="shrink-0 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-normal tabular-nums text-white ring-1 ring-white/15 dark:bg-black/50">
        {yearLabel}
      </span>
    );

  const collapsedW = 'w-10';
  const expandedW =
    side === 'left'
      ? label.length <= 3
        ? 'w-[80px] sm:w-[84px]'
        : 'w-[100px] sm:w-[104px]'
      : 'w-[58px] sm:w-[62px]';

  return (
    <div
      className={`pointer-events-none relative flex h-7 shrink-0 items-center overflow-hidden rounded-full bg-black/35 shadow-[0_1px_4px_rgba(0,0,0,0.65)] ring-1 ring-white/20 backdrop-blur-sm transition-[width] duration-300 ease-out dark:bg-black/45 dark:ring-white/10 ${
        open ? expandedW : collapsedW
      } ${open ? (side === 'left' ? 'justify-start pl-1' : 'justify-end pr-1') : 'justify-center'}`}
      aria-hidden
    >
      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 transition-opacity duration-200 ${
          open ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success shadow-sm ring-1 ring-white/35" />
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/85 shadow-sm ring-1 ring-black/15" />
      </div>
      <div
        className={`flex h-full w-full min-w-0 items-center transition-opacity duration-200 ${
          open ? 'opacity-100 delay-75' : 'opacity-0'
        } ${side === 'left' ? 'justify-start' : 'justify-end'}`}
      >
        {expanded}
      </div>
    </div>
  );
}

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
 * Wide tile: backdrop/poster, left/right meta pills (dots → type / year on card hover),
 * title on bottom overlay.
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => setFineHover(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleCardEnter = () => {
    if (!fineHover) return;
    clearTimer();
    timerRef.current = setTimeout(() => setMetaOpen(true), CATALOG_META_HOVER_MS);
  };

  const handleCardLeave = () => {
    if (!fineHover) return;
    clearTimer();
    setMetaOpen(false);
  };

  const effectiveMetaOpen = fineHover ? metaOpen : true;

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
          className="relative aspect-[16/10] w-full overflow-hidden p-0"
          onMouseEnter={src ? handleCardEnter : undefined}
          onMouseLeave={src ? handleCardLeave : undefined}
        >
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
            <>
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[48%] bg-gradient-to-t from-black/82 via-black/35 to-transparent"
                aria-hidden
              />
              <div className="pointer-events-none absolute left-2 top-2 z-[3] flex items-center gap-2 sm:left-3 sm:top-3">
                <CatalogMetaPill
                  side="left"
                  open={effectiveMetaOpen}
                  label={label}
                  yearLabel={year}
                />
              </div>
              <div className="pointer-events-none absolute right-2 top-2 z-[3] flex items-center justify-end sm:right-3 sm:top-3">
                <CatalogMetaPill
                  side="right"
                  open={effectiveMetaOpen}
                  label={label}
                  yearLabel={year}
                />
              </div>
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
            </>
          )}
        </CardBody>
      </Card>
    </Link>
  );
}
