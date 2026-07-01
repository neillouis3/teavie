import type { ContentItem } from "@/types/content";
import type { CatalogGenreRow } from "@/components/genre/genreTileShared";
import { readClientDayCache, writeClientDayCache } from "@/lib/clientDayCache";
import type { WatchHistoryEntry } from "@/lib/watchHistory";
import type { UserPreferences } from "@/types/user";
import { hasUserPreferences } from "@/types/user";
import { contentItemMatchesPreferences, sortContentItemsByGenrePreference } from "@/lib/preferenceMatch";
import {
  fetchExploreBundle,
  fetchDiscoverFeed,
  type TmdbDiscoverPayload,
  type ExploreBundle,
} from "@/lib/pageDataCache";

export type { TmdbDiscoverPayload };

const EXPLORE_HISTORY_CACHE_PREFIX = "teavie.cache.explore.history.v2:";

export type ExploreHistoryRow = ContentItem & {
  progressLabel: string;
  lastSeason: number;
  lastEpisode: number;
};

export type ExplorePagePayload = {
  discover: TmdbDiscoverPayload;
  genres: CatalogGenreRow[];
  historyRows: ExploreHistoryRow[];
  watchLaterRows: ContentItem[];
  favoriteRows: ContentItem[];
  recommendedRows: ContentItem[];
  newContent: ContentItem[];
  upcomingContent: ContentItem[];
  personalized: PersonalizedExploreBundle | null;
};

export type PersonalizedExploreBundle = {
  recommended: ContentItem[];
  spotlight: ContentItem[];
  popularMovies: ContentItem[];
  popularTv: ContentItem[];
  newContent: ContentItem[];
  upcomingContent: ContentItem[];
};

function historyCacheKey(entries: WatchHistoryEntry[]): string {
  const sig = entries
    .map(
      (e) =>
        `${e.mediaType}:${e.catalogId}:s${e.lastSeason}e${e.lastEpisode}`
    )
    .sort()
    .join("|");
  return `${EXPLORE_HISTORY_CACHE_PREFIX}${sig || "empty"}`;
}

function mergeHistoryRows(
  cached: ExploreHistoryRow[],
  entries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string
): ExploreHistoryRow[] {
  const entryById = new Map(entries.map((e) => [e.catalogId, e]));
  return cached
    .map((row) => {
      const entry = entryById.get(String(row.id));
      if (!entry) return null;
      return {
        ...row,
        lastSeason: entry.lastSeason,
        lastEpisode: entry.lastEpisode,
        progressLabel: progressLabel(entry),
      };
    })
    .filter((row): row is ExploreHistoryRow => row != null);
}

export async function fetchExploreHistoryRows(
  entries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string
): Promise<ExploreHistoryRow[]> {
  if (entries.length === 0) return [];

  const cacheKey = historyCacheKey(entries);
  const cached = readClientDayCache<ExploreHistoryRow[]>(cacheKey);
  if (cached) {
    const merged = mergeHistoryRows(cached, entries, progressLabel);
    if (merged.length === entries.length) return merged;
  }

  try {
    const res = await fetch("/api/catalog/history", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entries: entries.map((e) => ({
          catalogId: e.catalogId,
          mediaType: e.mediaType,
        })),
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: ContentItem[] };
    const byId = new Map((json.items ?? []).map((item) => [String(item.id), item]));
    const rows: ExploreHistoryRow[] = [];
    for (const entry of entries) {
      const item = byId.get(entry.catalogId);
      if (!item) continue;
      rows.push({
        ...item,
        id: entry.catalogId,
        progressLabel: progressLabel(entry),
        lastSeason: entry.lastSeason,
        lastEpisode: entry.lastEpisode,
      });
    }
    writeClientDayCache(cacheKey, rows);
    return rows;
  } catch {
    return [];
  }
}

/** Rebuild history rows from existing rail data (no network). Returns null if a new title needs fetch. */
export function projectExploreHistoryRows(
  existingRows: ExploreHistoryRow[],
  entries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string
): ExploreHistoryRow[] | null {
  if (entries.length === 0) return [];
  const byId = new Map(existingRows.map((r) => [String(r.id), r]));
  if (!entries.every((e) => byId.has(e.catalogId))) return null;
  return entries.map((entry) => {
    const row = byId.get(entry.catalogId)!;
    return {
      ...row,
      lastSeason: entry.lastSeason,
      lastEpisode: entry.lastEpisode,
      progressLabel: progressLabel(entry),
    };
  });
}

function dedupeCatalogEntries(
  entries: { catalogId: string; mediaType: "movie" | "tv" }[]
): { catalogId: string; mediaType: "movie" | "tv" }[] {
  const seen = new Set<string>();
  const out: { catalogId: string; mediaType: "movie" | "tv" }[] = [];
  for (const entry of entries) {
    if (seen.has(entry.catalogId)) continue;
    seen.add(entry.catalogId);
    out.push(entry);
  }
  return out;
}

function catalogEntriesSignature(
  entries: { catalogId: string; mediaType: "movie" | "tv" }[]
): string {
  return entries
    .map((e) => `${e.mediaType}:${e.catalogId}`)
    .sort()
    .join("|");
}

const catalogRowsInflight = new Map<string, Promise<ContentItem[]>>();

async function fetchCatalogEntryRowsImpl(
  entries: { catalogId: string; mediaType: "movie" | "tv" }[]
): Promise<ContentItem[]> {
  if (entries.length === 0) return [];
  try {
    const res = await fetch("/api/catalog/history", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entries: entries.map((e) => ({
          catalogId: e.catalogId,
          mediaType: e.mediaType,
        })),
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: ContentItem[] };
    const byId = new Map((json.items ?? []).map((item) => [String(item.id), item]));
    const rows: ContentItem[] = [];
    for (const entry of entries) {
      const item = byId.get(entry.catalogId);
      if (item) rows.push({ ...item, id: entry.catalogId });
    }
    return rows;
  } catch {
    return [];
  }
}

export async function fetchCatalogEntryRows(
  entries: { catalogId: string; mediaType: "movie" | "tv" }[]
): Promise<ContentItem[]> {
  const deduped = dedupeCatalogEntries(entries);
  if (deduped.length === 0) return [];

  const key = catalogEntriesSignature(deduped);
  const inflight = catalogRowsInflight.get(key);
  if (inflight) return inflight;

  const promise = fetchCatalogEntryRowsImpl(deduped).finally(() => {
    catalogRowsInflight.delete(key);
  });
  catalogRowsInflight.set(key, promise);
  return promise;
}

export type UserRailRows = {
  historyRows: ExploreHistoryRow[];
  watchLaterRows: ContentItem[];
  favoriteRows: ContentItem[];
};

/** One catalog/history request for continue watching, watch later, and favorites. */
export async function fetchUserRailRows(options: {
  historyEntries: WatchHistoryEntry[];
  watchLaterEntries: { catalogId: string; mediaType: "movie" | "tv" }[];
  favoriteEntries: { catalogId: string; mediaType: "movie" | "tv" }[];
  progressLabel: (entry: WatchHistoryEntry) => string;
}): Promise<UserRailRows> {
  const { historyEntries, watchLaterEntries, favoriteEntries, progressLabel } =
    options;

  if (
    historyEntries.length === 0 &&
    watchLaterEntries.length === 0 &&
    favoriteEntries.length === 0
  ) {
    return { historyRows: [], watchLaterRows: [], favoriteRows: [] };
  }

  if (
    historyEntries.length > 0 &&
    watchLaterEntries.length === 0 &&
    favoriteEntries.length === 0
  ) {
    const historyRows = await fetchExploreHistoryRows(historyEntries, progressLabel);
    return { historyRows, watchLaterRows: [], favoriteRows: [] };
  }

  const batchEntries = dedupeCatalogEntries([
    ...historyEntries.map((e) => ({
      catalogId: e.catalogId,
      mediaType: e.mediaType,
    })),
    ...watchLaterEntries,
    ...favoriteEntries,
  ]);

  const items = await fetchCatalogEntryRows(batchEntries);
  const byId = new Map(items.map((item) => [String(item.id), item]));

  const historyRows: ExploreHistoryRow[] = [];
  for (const entry of historyEntries) {
    const item = byId.get(entry.catalogId);
    if (!item) continue;
    historyRows.push({
      ...item,
      id: entry.catalogId,
      progressLabel: progressLabel(entry),
      lastSeason: entry.lastSeason,
      lastEpisode: entry.lastEpisode,
    });
  }
  if (historyRows.length > 0) {
    writeClientDayCache(historyCacheKey(historyEntries), historyRows);
  }

  const watchLaterRows: ContentItem[] = [];
  for (const entry of watchLaterEntries) {
    const item = byId.get(entry.catalogId);
    if (item) watchLaterRows.push({ ...item, id: entry.catalogId });
  }

  const favoriteRows: ContentItem[] = [];
  for (const entry of favoriteEntries) {
    const item = byId.get(entry.catalogId);
    if (item) favoriteRows.push({ ...item, id: entry.catalogId });
  }

  return { historyRows, watchLaterRows, favoriteRows };
}

export async function fetchWatchLaterRows(
  entries: { catalogId: string; mediaType: "movie" | "tv" }[]
): Promise<ContentItem[]> {
  return fetchCatalogEntryRows(entries);
}

export async function fetchFavoriteRows(
  entries: { catalogId: string; mediaType: "movie" | "tv" }[]
): Promise<ContentItem[]> {
  return fetchCatalogEntryRows(entries);
}

export async function fetchPersonalizedRows(
  preferences: UserPreferences | null
): Promise<ContentItem[]> {
  const bundle = await fetchPersonalizedExploreBundle(preferences);
  return bundle?.recommended ?? [];
}

export async function fetchPersonalizedExploreBundle(
  preferences: UserPreferences | null
): Promise<PersonalizedExploreBundle | null> {
  if (!preferences || !hasUserPreferences(preferences)) return null;
  const key = JSON.stringify(preferences);
  const inflight = personalizedInflight.get(key);
  if (inflight) return inflight;

  const promise = fetchPersonalizedExploreBundleImpl(preferences).finally(() => {
    personalizedInflight.delete(key);
  });
  personalizedInflight.set(key, promise);
  return promise;
}

const personalizedInflight = new Map<string, Promise<PersonalizedExploreBundle | null>>();

async function fetchPersonalizedExploreBundleImpl(
  preferences: UserPreferences
): Promise<PersonalizedExploreBundle | null> {
  try {
    const res = await fetch("/api/explore/personalized", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ preferences, bundle: true }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      bundle?: PersonalizedExploreBundle | null;
    };
    return json.bundle ?? null;
  } catch {
    return null;
  }
}

function filterRailByPreferences(
  items: ContentItem[],
  preferences: UserPreferences | null
): ContentItem[] {
  if (!preferences || !hasUserPreferences(preferences)) return items;
  const filtered = items.filter((item) =>
    contentItemMatchesPreferences(item, preferences)
  );
  return sortContentItemsByGenrePreference(filtered, preferences);
}

function buildDiscoverFromPersonalized(
  bundle: ExploreBundle,
  personalized: PersonalizedExploreBundle | null,
  preferences: UserPreferences | null
): TmdbDiscoverPayload {
  if (!personalized) return bundle.discover;

  const personalizedOnly = hasUserPreferences(preferences);
  const personalizedMovies = filterRailByPreferences(
    personalized.recommended.filter((item) => item.type === "movie"),
    preferences
  );
  const personalizedTv = filterRailByPreferences(
    personalized.recommended.filter((item) => item.type === "tv"),
    preferences
  );
  const popularMovies = filterRailByPreferences(
    personalized.popularMovies,
    preferences
  );
  const popularTv = filterRailByPreferences(
    personalized.popularTv,
    preferences
  );

  const pickRail = (personalizedItems: ContentItem[], fallbackItems: ContentItem[]) =>
    personalizedItems.length > 0 || personalizedOnly
      ? personalizedItems
      : fallbackItems;

  return {
    ...bundle.discover,
    trendingMovies: pickRail(personalizedMovies, bundle.discover.trendingMovies),
    trendingTv: pickRail(personalizedTv, bundle.discover.trendingTv),
    popularMovies: pickRail(popularMovies, bundle.discover.popularMovies),
    popularTv: pickRail(popularTv, bundle.discover.popularTv),
  };
}

export type ExploreCorePayload = Omit<
  ExplorePagePayload,
  "historyRows" | "watchLaterRows" | "favoriteRows"
>;

export async function loadExploreCorePayload(
  preferences: UserPreferences | null
): Promise<ExploreCorePayload> {
  const [bundle, feed, personalized] = await Promise.all([
    fetchExploreBundle(),
    fetchDiscoverFeed(),
    fetchPersonalizedExploreBundle(preferences),
  ]);

  return {
    discover: buildDiscoverFromPersonalized(bundle, personalized, preferences),
    genres: bundle.genres,
    recommendedRows: filterRailByPreferences(
      personalized?.recommended ?? [],
      preferences
    ),
    newContent:
      personalized &&
      (personalized.newContent.length > 0 || hasUserPreferences(preferences))
        ? filterRailByPreferences(personalized.newContent, preferences)
        : feed.newContent,
    upcomingContent:
      personalized &&
      (personalized.upcomingContent.length > 0 || hasUserPreferences(preferences))
        ? filterRailByPreferences(personalized.upcomingContent, preferences)
        : feed.upcomingContent,
    personalized,
  };
}

export async function loadExplorePagePayload(
  historyEntries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string,
  options?: {
    watchLaterEntries?: { catalogId: string; mediaType: "movie" | "tv" }[];
    favoriteEntries?: { catalogId: string; mediaType: "movie" | "tv" }[];
    preferences?: UserPreferences | null;
  }
): Promise<ExplorePagePayload> {
  const watchLaterEntries = options?.watchLaterEntries ?? [];
  const favoriteEntries = options?.favoriteEntries ?? [];
  const preferences = options?.preferences ?? null;

  const [core, rails] = await Promise.all([
    loadExploreCorePayload(preferences),
    fetchUserRailRows({
      historyEntries,
      watchLaterEntries,
      favoriteEntries,
      progressLabel,
    }),
  ]);

  return { ...core, ...rails };
}

export { fetchExploreBundle, type ExploreBundle };
