import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface SmallCardProps {
  id: number | string;
  title: string;
  year: string;
  /** e.g. “Released Apr 1, 2025” for Explore “new” rail */
  releaseNote?: string;
  runtimeSeconds?: number;
  seasonAmount: number;
  /** When set, TV tiles show episode count instead of seasons only. */
  numberOfEpisodes?: number | null;
  type: string;
  posterPath: string;
  /** When set, overrides `/shows/{id}` / `/movies/{id}` (e.g. AniList URL). */
  linkHref?: string | null;
}

export default function SmallCard({
  id,
  title,
  year,
  releaseNote,
  runtimeSeconds,
  seasonAmount,
  numberOfEpisodes,
  type,
  posterPath,
  linkHref,
}: SmallCardProps) {
  const typeLower = (type ?? '').toLowerCase();
  const runtimeMin =
    runtimeSeconds != null ? Math.round(runtimeSeconds / 60) : null;
  const baseUrl = 'https://image.tmdb.org/t/p/';
  const size = 'w500';
  const hasPoster = Boolean(posterPath?.trim());
  const imageUrl = hasPoster
    ? /^https?:\/\//i.test(posterPath)
      ? posterPath
      : `${baseUrl}${size}${posterPath}`
    : '';
  const defaultHref = typeLower === 'tv' ? `/shows/${id}` : `/movies/${id}`;
  const resolvedHref = String(linkHref ?? '').trim() || defaultHref;
  const external = /^https?:\/\//i.test(resolvedHref);

  const poster = (
    <div className="relative aspect-[2/3] w-full shrink-0 overflow-hidden rounded-xl bg-default-200">
      {hasPoster ? (
        <Image
          src={imageUrl}
          alt={title}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 20vw, 140px"
          className="object-cover transition-opacity duration-300 group-hover:opacity-50"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-default-500">
          No poster
        </div>
      )}
    </div>
  );

  const meta = (
    <div className="mt-2 flex shrink-0 flex-col gap-1 rounded-b-xl text-gray-500">
        <div className="flex w-full flex-row items-center justify-between gap-1">
          <p className="flex-1 truncate text-start text-xs">{year}</p>
          <div className="flex-shrink-0 rounded-2xl border border-gray-500 px-2 py-0.5 text-center text-xs uppercase transition-colors duration-300 group-hover:border-success group-hover:text-success">
            {typeLower === 'tv'
              ? 'TV'
              : typeLower === 'movie'
                ? 'Movie'
                : type}
          </div>
          <p className="flex-1 truncate text-end text-xs">
            {typeLower === 'tv'
              ? (() => {
                  const eps =
                    typeof numberOfEpisodes === "number" && numberOfEpisodes > 0
                      ? numberOfEpisodes
                      : null;
                  if (eps != null) return `${eps} ep${eps === 1 ? "" : "s"}`;
                  if (seasonAmount != null && seasonAmount > 0)
                    return `${seasonAmount} season${seasonAmount === 1 ? "" : "s"}`;
                  return "—";
                })()
              : typeLower === 'movie'
                ? runtimeMin != null
                  ? `${runtimeMin} min`
                  : '—'
                : ''}
          </p>
        </div>
        <h1
          className="min-h-[2.5rem] text-sm font-medium leading-snug text-foreground line-clamp-2 transition-colors duration-300 group-hover:text-success sm:text-[15px]"
          title={title}
        >
          {title}
        </h1>
        {releaseNote ? (
          <p
            className="mt-0.5 min-h-[2.5rem] line-clamp-2 text-[11px] leading-snug text-default-500"
            title={releaseNote}
          >
            {releaseNote}
          </p>
        ) : null}
      </div>
  );

  const shellClass = 'group flex min-w-0 w-full flex-col rounded-xl';

  if (external) {
    return (
      <a
        href={resolvedHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`${shellClass} block`}
        aria-label={`${title}, ${year}`}
      >
        {poster}
        {meta}
      </a>
    );
  }

  return (
    <Link href={resolvedHref} className={`${shellClass} block`} aria-label={`${title}, ${year}`}>
      {poster}
      {meta}
    </Link>
  );
}
