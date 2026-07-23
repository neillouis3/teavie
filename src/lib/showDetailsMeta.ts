import type { CatalogDetailLink, CatalogInfoLine } from "@/components/ui/catalogDetailColumns";
import {
  countryNamesFromCodes,
  languageDisplayName,
  sortedCompanyNames,
} from "@/components/ui/catalogDetailColumns";
import { formatFullReleaseDate, formatHeroDate } from "@/lib/formatRelease";
import {
  Building02Icon,
  Calendar03Icon,
  Clock01Icon,
  LanguageCircleIcon,
  Location01Icon,
  StarIcon,
  Tv01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";

export type ShowDetailsSource = {
  name: string;
  first_air_date?: string | null;
  last_air_date?: string | null;
  status?: string | null;
  vote_average?: number | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  episode_run_time?: number[] | null;
  original_language?: string | null;
  origin_country?: string[];
  production_countries?: { name?: string }[];
  production_companies?: { name?: string }[];
  networks?: { name?: string }[];
  studios?: { name?: string }[];
  created_by?: { name?: string }[];
  homepage?: string | null;
  is_anime?: boolean;
  mal_id?: number | null;
  external_ids?: {
    mal_id?: number | null;
    imdb_id?: string | null;
  } | null;
  anilist?: {
    siteUrl?: string | null;
    title?: {
      romaji?: string | null;
      english?: string | null;
      native?: string | null;
    };
    averageScore?: number | null;
    season?: string | null;
    seasonYear?: number | null;
    format?: string | null;
    episodes?: number | null;
    status?: string | null;
  } | null;
};

const ANILIST_FORMAT_LABELS: Record<string, string> = {
  TV: "TV series",
  TV_SHORT: "TV short",
  MOVIE: "Movie",
  SPECIAL: "Special",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Music",
};

function formatAnilistSeason(
  season: string | null | undefined,
  year: number | null | undefined
): string | null {
  const s = String(season ?? "").trim();
  if (!s && year == null) return null;
  const seasonLabel = s
    ? s.charAt(0) + s.slice(1).toLowerCase()
    : null;
  if (seasonLabel && year != null) return `${seasonLabel} ${year}`;
  return seasonLabel ?? (year != null ? String(year) : null);
}

function uniqueStrings(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = String(value ?? "").trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function buildShowAlternateTitles(show: ShowDetailsSource): string[] {
  const primary = String(show.name ?? "").trim();
  const t = show.anilist?.title;
  return uniqueStrings([
    t?.english,
    t?.romaji,
    t?.native,
  ]).filter((title) => title !== primary);
}

export function buildShowNetworkTags(show: ShowDetailsSource): string[] {
  const networks = (show.networks ?? []).map((n) => n?.name);
  const studios = (show.studios ?? []).map((s) => s?.name);
  const companies = (show.production_companies ?? []).map((c) => c?.name);
  return uniqueStrings([...networks, ...studios, ...companies]).slice(0, 6);
}

export function buildShowDetailStatPills(
  show: ShowDetailsSource,
  isAnime: boolean
): string[] {
  // Regular TV already shows seasons / episodes / year / rating above — pills only
  // add anime-specific facts that aren't repeated elsewhere.
  if (!isAnime) return [];

  if (!show.anilist?.format) return [];
  const format = ANILIST_FORMAT_LABELS[show.anilist.format] ?? show.anilist.format;
  return format ? [format] : [];
}

export function buildExtendedShowInfoLines(
  show: ShowDetailsSource,
  isAnime: boolean
): CatalogInfoLine[] {
  const lines: CatalogInfoLine[] = [];

  if (isAnime) {
    const premiere = formatAnilistSeason(
      show.anilist?.season,
      show.anilist?.seasonYear ?? undefined
    );
    if (premiere) {
      lines.push({ icon: Calendar03Icon, label: `Premiered ${premiere}` });
    } else {
      const firstAir = formatFullReleaseDate(show.first_air_date);
      if (firstAir) lines.push({ icon: Calendar03Icon, label: `Premiered ${firstAir}` });
    }

    const aniStatus = mapAnilistStatusLabel(show.anilist?.status ?? show.status);
    if (aniStatus) {
      lines.push({ icon: StarIcon, label: aniStatus });
    }

    const runtime = show.episode_run_time?.[0];
    if (runtime && runtime > 0) {
      lines.push({ icon: Clock01Icon, label: `~${runtime} min per episode` });
    }
  } else {
    const premiere = formatFullReleaseDate(show.first_air_date);
    if (premiere) {
      lines.push({ icon: Calendar03Icon, label: `Premiered ${premiere}` });
    }

    const lastAir = show.last_air_date;
    if (lastAir && String(lastAir).length >= 10) {
      const ended = /ended|canceled|cancelled/i.test(String(show.status ?? ""));
      const when =
        formatFullReleaseDate(lastAir) ??
        formatHeroDate(lastAir) ??
        lastAir.slice(0, 10);
      lines.push({
        icon: Calendar03Icon,
        label: ended ? `Ended ${when}` : `Latest episode ${when}`,
      });
    }

    const runtime = show.episode_run_time?.[0];
    if (runtime && runtime > 0) {
      lines.push({ icon: Clock01Icon, label: `~${runtime} min per episode` });
    }

    const creators = (show.created_by ?? [])
      .map((person) => String(person?.name ?? "").trim())
      .filter(Boolean)
      .slice(0, 2);
    if (creators.length > 0) {
      lines.push({ icon: UserIcon, label: creators.join(", ") });
    }
  }

  const networkNames = uniqueStrings((show.networks ?? []).map((n) => n?.name));
  if (networkNames.length > 0) {
    lines.push({ icon: Tv01Icon, label: networkNames.slice(0, 3).join(", ") });
  }

  const companies = sortedCompanyNames(
    [
      ...(show.production_companies ?? []),
      ...((show.studios ?? []).map((s) => ({ name: s?.name })) as { name?: string }[]),
    ],
    2
  );
  if (companies.length > 0) {
    lines.push({ icon: Building02Icon, label: companies.join(", ") });
  }

  const country =
    (show.production_countries ?? [])
      .map((p) => String(p?.name ?? "").trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(", ") || countryNamesFromCodes(show.origin_country);
  if (country) {
    lines.push({ icon: Location01Icon, label: country });
  }

  const language = languageDisplayName(show.original_language);
  if (language) {
    lines.push({ icon: LanguageCircleIcon, label: language });
  }

  return dedupeInfoLines(lines);
}

function mapAnilistStatusLabel(status: string | null | undefined): string | null {
  const raw = String(status ?? "").trim();
  if (!raw) return null;
  const mapped: Record<string, string> = {
    FINISHED: "Finished airing",
    RELEASING: "Currently airing",
    NOT_YET_RELEASED: "Not yet aired",
    CANCELLED: "Cancelled",
    HIATUS: "On hiatus",
  };
  return mapped[raw] ?? raw.replace(/_/g, " ").toLowerCase();
}

function dedupeInfoLines(lines: CatalogInfoLine[]): CatalogInfoLine[] {
  const seen = new Set<string>();
  const out: CatalogInfoLine[] = [];
  for (const line of lines) {
    const label = String(line.label ?? "").trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push({ ...line, label });
  }
  return out;
}

export function buildShowDetailLinks(show: ShowDetailsSource): CatalogDetailLink[] {
  const links: CatalogDetailLink[] = [];
  const imdbId = show.external_ids?.imdb_id;
  if (imdbId && /^tt\d+/i.test(String(imdbId))) {
    links.push({
      href: `https://www.imdb.com/title/${imdbId}/`,
      label: "IMDb",
    });
  }

  const homepage = String(show.homepage ?? "").trim();
  if (homepage) {
    links.push({ href: homepage, label: "Official site" });
  }

  const anilistUrl = String(show.anilist?.siteUrl ?? "").trim();
  if (anilistUrl) {
    links.push({ href: anilistUrl, label: "AniList" });
  }

  const malId = show.mal_id ?? show.external_ids?.mal_id;
  if (typeof malId === "number" && malId > 0) {
    links.push({
      href: `https://myanimelist.net/anime/${malId}`,
      label: "MyAnimeList",
    });
  }

  return links;
}
