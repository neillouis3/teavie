"use client";

import React from "react";
import Link from "next/link";
import { Chip } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Link01Icon,
  TagsIcon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";

export type CatalogGenre = { id: number; name: string };

export type CatalogDetailLink = {
  href: string;
  label: string;
  icon?: IconSvgElement;
};

type CatalogDetailColumnsProps = {
  mediaType: "movie" | "tv";
  genres: CatalogGenre[];
  details: string[];
  links: CatalogDetailLink[];
  className?: string;
};

function genreBrowseHref(mediaType: "movie" | "tv", genreId: number) {
  const base = mediaType === "movie" ? "/movies/all" : "/shows/all";
  const params = new URLSearchParams({
    genre: String(genreId),
    sort_by: "popularity",
  });
  return `${base}?${params.toString()}`;
}

function ColumnHeading({
  icon,
  label,
}: {
  icon: IconSvgElement;
  label: string;
}) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-medium text-default-500">
      <HugeiconsIcon icon={icon} size={16} className="shrink-0 opacity-80" />
      {label}
    </h3>
  );
}

export default function CatalogDetailColumns({
  mediaType,
  genres,
  details,
  links,
  className = "",
}: CatalogDetailColumnsProps) {
  const sortedGenres = [...genres]
    .filter((g) => g?.name && Number.isFinite(g.id))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const detailLines = details.filter((line) => String(line ?? "").trim());
  const linkItems = links.filter((l) => l?.href && l?.label);

  return (
    <div
      className={`grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8 ${className}`}
    >
      <div className="min-w-0">
        <ColumnHeading icon={TagsIcon} label="Genre" />
        <div className="mt-2.5 flex flex-col items-start gap-2">
          {sortedGenres.length > 0 ? (
            sortedGenres.map((genre) => (
              <Link
                key={genre.id}
                href={genreBrowseHref(mediaType, genre.id)}
                className="inline-flex max-w-full"
              >
                <Chip
                  size="sm"
                  variant="flat"
                  className="cursor-pointer border border-default-200/80 bg-default-100/80 transition-colors hover:border-success/40 hover:bg-success/10 dark:border-default-100/30 dark:bg-default-100/20"
                >
                  {genre.name}
                </Chip>
              </Link>
            ))
          ) : (
            <span className="text-sm text-foreground/70">—</span>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <ColumnHeading icon={InformationCircleIcon} label="Details" />
        <ul className="mt-2.5 flex flex-col gap-1.5 text-sm text-foreground">
          {detailLines.length > 0 ? (
            detailLines.map((line) => (
              <li key={line} className="leading-snug">
                {line}
              </li>
            ))
          ) : (
            <li className="text-foreground/70">—</li>
          )}
        </ul>
      </div>

      <div className="min-w-0">
        <ColumnHeading icon={Link01Icon} label="Links" />
        <ul className="mt-2.5 flex flex-col gap-2">
          {linkItems.length > 0 ? (
            linkItems.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary underline-offset-2 transition-colors hover:text-success hover:underline"
                >
                  {link.icon ? (
                    <HugeiconsIcon icon={link.icon} size={15} className="shrink-0 opacity-80" />
                  ) : null}
                  {link.label}
                </a>
              </li>
            ))
          ) : (
            <li className="text-sm text-foreground/70">—</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export function countryNamesFromCodes(codes: string[] | undefined): string | null {
  if (!Array.isArray(codes) || codes.length === 0) return null;
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    const names = codes
      .map((c) => dn.of(String(c).toUpperCase()) ?? String(c).toUpperCase())
      .filter(Boolean);
    return names.length ? [...new Set(names)].join(", ") : null;
  } catch {
    return codes.map((c) => String(c).toUpperCase()).join(", ");
  }
}

export function languageDisplayName(code: string | undefined | null): string | null {
  const c = String(code ?? "").trim().toLowerCase();
  if (!c) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(c) ?? c.toUpperCase();
  } catch {
    return c.toUpperCase();
  }
}

export function sortedCompanyNames(
  companies: { name?: string }[] | undefined,
  max = 4
): string[] {
  if (!Array.isArray(companies)) return [];
  return companies
    .map((c) => String(c?.name ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .slice(0, max);
}
