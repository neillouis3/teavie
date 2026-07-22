"use client";

import React from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Building02Icon,
  Calendar03Icon,
  LanguageCircleIcon,
  LinkSquare02Icon,
  Location01Icon,
} from "@hugeicons/core-free-icons";

import {
  genrePageHref,
  imdbGenreSlugFromLabel,
  imdbGenresForDisplayInput,
} from "@/lib/imdbGenres";

export type CatalogGenre = { name: string; slug: string };

export type CatalogInfoLine = {
  icon: IconSvgElement;
  label: string;
};

export type CatalogDetailLink = {
  href: string;
  label: string;
  icon?: IconSvgElement;
};

type CatalogDetailColumnsProps = {
  mediaType: "movie" | "tv";
  genres: CatalogGenre[];
  infoLines: CatalogInfoLine[];
  links: CatalogDetailLink[];
  networkTags?: string[];
  /** When set, genre chips link to this browse base (e.g. `/kdrama/all`). */
  genreBrowseBase?: string;
  className?: string;
};

function genreBrowseHref(
  mediaType: "movie" | "tv",
  slug: string,
  genreBrowseBase?: string
) {
  if (genreBrowseBase?.startsWith("/kdrama")) {
    const params = new URLSearchParams({ genre: slug, sort_by: "popularity" });
    return `/kdrama/all?${params.toString()}`;
  }
  return genrePageHref(slug, {
    type: mediaType === "movie" ? "movie" : "tv",
  });
}

function ColumnHeading({ label }: { label: string }) {
  return (
    <h3 className="text-xs font-medium text-default-500">
      {label}
    </h3>
  );
}

export default function CatalogDetailColumns({
  mediaType,
  genres,
  infoLines,
  links,
  networkTags = [],
  genreBrowseBase,
  className = "",
}: CatalogDetailColumnsProps) {
  const sortedGenres = [...genres]
    .filter((g) => g?.name && g?.slug)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const infoItems = infoLines.filter((line) => String(line?.label ?? "").trim());
  const linkItems = links.filter((l) => l?.href && l?.label);
  const networks = networkTags.filter((tag) => String(tag).trim());

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.85fr)] lg:gap-8">
        <div className="min-w-0">
          <ColumnHeading label="Genre" />
          <div className="mt-2.5 flex flex-wrap gap-2 text-sm text-foreground">
            {sortedGenres.length > 0 ? (
              sortedGenres.map((genre) => (
                <Link
                  key={genre.slug}
                  href={genreBrowseHref(mediaType, genre.slug, genreBrowseBase)}
                  className="inline-flex max-w-full items-center rounded-full border border-default-200/80 bg-default-100/80 px-2.5 py-0.5 text-inherit leading-snug transition-colors hover:border-success/40 hover:bg-success/10 dark:border-default-100/30 dark:bg-default-100/20"
                >
                  {genre.name}
                </Link>
              ))
            ) : (
              <span className="text-foreground/70">—</span>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <ColumnHeading label="Details" />
          <ul className="mt-2.5 grid w-full max-w-full grid-cols-1 gap-x-4 gap-y-2.5 text-sm text-foreground sm:grid-cols-2">
            {infoItems.length > 0 ? (
              infoItems.map((line, index) => (
                <li key={`${line.label}-${index}`} className="flex items-start gap-2 leading-snug">
                  <HugeiconsIcon
                    icon={line.icon}
                    size={15}
                    className="mt-0.5 shrink-0 text-default-500"
                  />
                  <span>{line.label}</span>
                </li>
              ))
            ) : (
              <li className="col-span-2 text-foreground/70">—</li>
            )}
          </ul>
        </div>

        <div className="min-w-0">
          <ColumnHeading label="Links" />
          <ul className="mt-2.5 flex flex-col gap-2">
            {linkItems.length > 0 ? (
              linkItems.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-2 transition-colors hover:text-success hover:underline"
                  >
                    {link.label}
                    <HugeiconsIcon
                      icon={link.icon ?? LinkSquare02Icon}
                      size={14}
                      className="shrink-0 opacity-80"
                    />
                  </a>
                </li>
              ))
            ) : (
              <li className="text-sm text-foreground/70">—</li>
            )}
          </ul>
        </div>
      </div>

      {networks.length > 0 ? (
        <div className="min-w-0 border-t border-default-200/60 pt-5 dark:border-default-100/20">
          <ColumnHeading label="Networks & studios" />
          <div className="mt-2.5 flex flex-wrap gap-2 text-sm text-foreground">
            {networks.map((name) => (
              <span
                key={name}
                className="inline-flex items-center rounded-md border border-default-200/70 bg-background/80 px-2.5 py-0.5 text-inherit leading-snug dark:border-default-100/25"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const MAX_DETAIL_LOCATION_COUNTRIES = 2;

function formatCountryList(names: string[]): string | null {
  const unique = [...new Set(names.map((n) => String(n).trim()).filter(Boolean))];
  if (unique.length === 0) return null;
  return unique.slice(0, MAX_DETAIL_LOCATION_COUNTRIES).join(", ");
}

export function countryNamesFromCodes(codes: string[] | undefined): string | null {
  if (!Array.isArray(codes) || codes.length === 0) return null;
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    const names = codes
      .map((c) => dn.of(String(c).toUpperCase()) ?? String(c).trim())
      .filter(Boolean);
    return formatCountryList(names);
  } catch {
    return formatCountryList(codes.map((c) => String(c).trim()).filter(Boolean));
  }
}

export function languageDisplayName(code: string | undefined | null): string | null {
  const c = String(code ?? "").trim().toLowerCase();
  if (!c) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(c) ?? c;
  } catch {
    return c;
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

function primaryStudioOrNetwork(show: {
  production_companies?: { name?: string }[];
  networks?: { name?: string }[];
  studios?: { name?: string }[];
}): string | null {
  const company = sortedCompanyNames(show.production_companies, 1)[0];
  if (company) return company;
  const networks = (show.networks ?? [])
    .map((n) => String(n?.name ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  if (networks[0]) return networks[0];
  const studios = (show.studios ?? [])
    .map((s) => String(s?.name ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return studios[0] ?? null;
}

function countryLabelFromShow(show: {
  production_countries?: { name?: string }[];
  origin_country?: string[];
}): string | null {
  const prodNames = (show.production_countries ?? [])
    .map((p) => String(p?.name ?? "").trim())
    .filter(Boolean);
  if (prodNames.length > 0) return formatCountryList(prodNames);
  return countryNamesFromCodes(show.origin_country);
}

export function buildMovieInfoLines(movie: {
  production_companies?: { name?: string }[];
  production_countries?: { iso_3166_1?: string; name?: string }[];
  origin_country?: string[];
  original_language?: string | null;
  release_date?: string | null;
}): CatalogInfoLine[] {
  const lines: CatalogInfoLine[] = [];
  const studio = sortedCompanyNames(movie.production_companies, 1)[0] ?? null;
  const country =
    (() => {
      const prod = movie.production_countries;
      if (Array.isArray(prod) && prod.length > 0) {
        const names = prod
          .map((p) => String(p?.name ?? "").trim())
          .filter(Boolean);
        if (names.length > 0) return formatCountryList(names);
      }
      const codes = movie.origin_country;
      if (Array.isArray(codes) && codes.length > 0) {
        return countryNamesFromCodes(codes);
      }
      return null;
    })() ?? null;

  if (studio) lines.push({ icon: Building02Icon, label: studio });
  if (country) lines.push({ icon: Location01Icon, label: country });

  const language = languageDisplayName(movie.original_language);
  if (language) lines.push({ icon: LanguageCircleIcon, label: language });

  const year = movie.release_date?.slice(0, 4);
  if (year) lines.push({ icon: Calendar03Icon, label: year });

  return lines;
}

export function buildShowInfoLines(show: {
  production_companies?: { name?: string }[];
  networks?: { name?: string }[];
  studios?: { name?: string }[];
  production_countries?: { name?: string }[];
  origin_country?: string[];
  original_language?: string | null;
  first_air_date?: string | null;
}): CatalogInfoLine[] {
  const lines: CatalogInfoLine[] = [];
  const primary = primaryStudioOrNetwork(show);
  const country = countryLabelFromShow(show);

  if (primary) lines.push({ icon: Building02Icon, label: primary });
  if (country) lines.push({ icon: Location01Icon, label: country });

  const language = languageDisplayName(show.original_language);
  if (language) lines.push({ icon: LanguageCircleIcon, label: language });

  return lines;
}

/** Map catalog / TMDB / OMDb genre sources to browse chips (unified IMDb labels). */
export function catalogGenresForDisplay(
  source:
    | {
        name?: string;
        imdb_genres?: string[];
        omdb?: { genre?: string | null };
        /** TMDB genres — display fallback when IMDb/OMDb are missing. */
        genres?: { id?: number; name?: string }[] | string[];
      }
    | { name?: string }[]
    | string[]
    | null
    | undefined
): CatalogGenre[] {
  const labels = imdbGenresForDisplayInput(source);
  return labels.map((name) => ({
    name,
    slug:
      imdbGenreSlugFromLabel(name) ??
      name.toLowerCase().replace(/\s+/g, "-"),
  }));
}
