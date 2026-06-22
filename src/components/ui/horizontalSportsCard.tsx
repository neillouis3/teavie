'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export type HorizontalSportsCardProps = {
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
};

const pill =
  'rounded-sm bg-black/55 px-2.5 py-1 text-[10px] text-white backdrop-blur-sm tabular-nums';

/**
 * Same wide tile treatment as {@link HorizontalCatalogCard}: backdrop image, title on bottom-left;
 * sports variant shows “Live” top-right and description under the image.
 */
export default function HorizontalSportsCard({
  slug,
  title,
  description,
  imageUrl,
}: HorizontalSportsCardProps) {
  const href = `/sports/${slug}`;
  const src = imageUrl?.trim() || '';

  return (
    <Link href={href} className="group block min-w-0 w-full" aria-label={`${title}, live stream`}>
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-default-200 ring-1 ring-white/10">
        {src ? (
          <Image
            src={src}
            alt=""
            aria-hidden
            fill
            unoptimized
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
            <p className="line-clamp-2 text-xs text-foreground">{title}</p>
            <span className="text-[10px] text-default-500">No image</span>
          </div>
        )}
        {src && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
            <div className="absolute right-2 top-2 sm:right-2.5 sm:top-2.5">
              <span className={pill}>Live</span>
            </div>
            <div className="absolute bottom-2 left-2 right-3 max-w-[85%] sm:bottom-2.5 sm:left-2.5 sm:right-4">
              <p className="line-clamp-2 text-left text-xs font-semibold leading-snug text-white drop-shadow-md sm:text-sm">
                {title}
              </p>
            </div>
          </>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-default-500">{description}</p>
    </Link>
  );
}
