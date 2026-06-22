'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export type VerticalSportsCardProps = {
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
};

const livePill =
  'rounded-sm bg-black/55 px-2.5 py-1 text-[10px] text-white backdrop-blur-sm tabular-nums';

/**
 * Poster-style tile aligned with {@link SmallCard}: 2/3 image, meta row, title;
 * “Live” badge on the poster (top-right), center pill “Sports”.
 */
export default function VerticalSportsCard({
  slug,
  title,
  description,
  imageUrl,
}: VerticalSportsCardProps) {
  const href = `/sports/${slug}`;
  const hasPoster = Boolean(imageUrl?.trim());

  const displayTitle =
    title.length > 25 ? `${title.slice(0, Math.ceil(title.length / 1.5))}…` : title;

  return (
    <div className="group flex min-w-0 w-full flex-col rounded-xl">
      <Link href={href} className="block w-full shrink-0" aria-label={`${title}, live stream`}>
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-default-200">
          {hasPoster ? (
            <Image
              src={imageUrl}
              alt=""
              aria-hidden
              fill
              unoptimized
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 20vw, 140px"
              className="object-cover transition-opacity duration-300 group-hover:opacity-50"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-default-500">
              No image
            </div>
          )}
          {hasPoster && (
            <>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              <div className="absolute right-2 top-2">
                <span className={livePill}>Live</span>
              </div>
            </>
          )}
        </div>
      </Link>

      <div className="mt-2 flex shrink-0 flex-col gap-1 rounded-b-xl text-gray-500">
        <div className="flex w-full flex-row items-center justify-between gap-1">
          <p className="flex-1 truncate text-start text-xs text-default-500">—</p>
          <div className="shrink-0 rounded-2xl border border-gray-500 px-2 py-0.5 text-center text-xs transition-colors duration-300 group-hover:border-success group-hover:text-success">
            Sports
          </div>
          <p className="flex-1 truncate text-end text-xs text-default-500">Live</p>
        </div>
        <h2
          className="text-md truncate transition-colors duration-300 group-hover:text-success"
          title={title}
        >
          {displayTitle}
        </h2>
        <p className="line-clamp-2 text-xs text-default-500">{description}</p>
      </div>
    </div>
  );
}
