import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatHeroRuntime } from '@/lib/formatRelease';
import { catalogDisplayTitle } from '@/lib/catalogDisplayTitle';
import { tmdbImageUrl } from '@/lib/tmdbImage';

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

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-default-200/90 px-2 py-0.5 text-[11px] font-medium leading-none text-foreground/75 dark:bg-white/10 dark:text-white/75">
      {children}
    </span>
  );
}

function buildMetaChips(
  typeLower: string,
  year: string,
  seasonAmount: number,
  numberOfEpisodes: number | null | undefined,
  runtimeSeconds?: number
): string[] {
  const chips: string[] = [];

  if (typeLower === 'tv') {
    const seasons = seasonAmount > 0 ? seasonAmount : 0;
    const eps =
      typeof numberOfEpisodes === 'number' && numberOfEpisodes > 0
        ? numberOfEpisodes
        : null;

    if (seasons > 1) {
      chips.push(`${seasons} SS`);
    } else if (eps != null) {
      chips.push(`${eps} EP`);
    }

    chips.push('TV');
  } else if (typeLower === 'movie') {
    const runtime = formatHeroRuntime(runtimeSeconds);
    if (runtime) chips.push(runtime);
    chips.push('MOVIE');
  } else {
    chips.push(typeLower.toUpperCase());
  }

  const when = String(year ?? '').trim();
  if (when && when !== 'N/A') chips.push(when);

  return chips;
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
  const hasPoster = Boolean(posterPath?.trim());
  const imageUrl = tmdbImageUrl(posterPath);
  const defaultHref = typeLower === 'tv' ? `/shows/${id}` : `/movies/${id}`;
  const resolvedHref = String(linkHref ?? '').trim() || defaultHref;
  const external = /^https?:\/\//i.test(resolvedHref);
  const metaChips = buildMetaChips(
    typeLower,
    year,
    seasonAmount,
    numberOfEpisodes,
    runtimeSeconds
  );
  const displayTitle = catalogDisplayTitle(title);

  const poster = (
    <div className="relative aspect-[2/3] w-full shrink-0 overflow-hidden rounded-xl bg-default-200">
      {hasPoster ? (
        <Image
          src={imageUrl}
          alt={title}
          fill
          unoptimized
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 20vw, 140px"
          className="object-cover transition-opacity duration-300 group-hover:opacity-90"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-default-500">
          No poster
        </div>
      )}
    </div>
  );

  const meta = (
    <div className="mt-2.5 flex min-w-0 flex-col gap-2">
      {metaChips.length > 0 ? (
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap">
          {metaChips.map((chip, i) => (
            <MetaChip key={`${chip}-${i}`}>{chip}</MetaChip>
          ))}
        </div>
      ) : null}
      <h2
        className="normal-case min-w-0 truncate text-sm leading-snug text-foreground transition-colors duration-300 group-hover:text-success sm:text-[15px]"
        title={displayTitle}
      >
        {displayTitle}
      </h2>
      {releaseNote ? (
        <p
          className="line-clamp-2 text-[11px] leading-snug text-default-500"
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
