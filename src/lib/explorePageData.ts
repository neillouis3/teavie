import type { ContentItem } from "@/types/content";
import type { CatalogGenreRow } from "@/components/genre/genreTileShared";
import { readClientDayCache, writeClientDayCache } from "@/lib/clientDayCache";
import type { WatchHistoryEntry } from "@/lib/watchHistory";
import type { UserPreferences } from "@/types/user";
import { hasUserPreferences } from "@/types/user";
import { contentItemMatchesPreferences, sortContentItemsByPreferenceRank } from "@/lib/preferenceMatch";
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
  preferences: UserPreferences | null,
  excludeMovieIds: string[] = []
): Promise<ContentItem[]> {
  const bundle = await fetchPersonalizedExploreBundle(preferences, excludeMovieIds);
  return bundle?.recommended ?? [];
}

export async function fetchPersonalizedExploreBundle(
  preferences: UserPreferences | null,
  excludeMovieIds: string[] = []
): Promise<PersonalizedExploreBundle | null> {
  if (!preferences || !hasUserPreferences(preferences)) return null;
  const excludeKey = [...excludeMovieIds].map(String).sort().join("|");
  const key = `${JSON.stringify(preferences)}::${excludeKey}`;
  const inflight = personalizedInflight.get(key);
  if (inflight) return inflight;

  const promise = fetchPersonalizedExploreBundleImpl(
    preferences,
    excludeMovieIds
  ).finally(() => {
    personalizedInflight.delete(key);
  });
  personalizedInflight.set(key, promise);
  return promise;
}

const personalizedInflight = new Map<string, Promise<PersonalizedExploreBundle | null>>();

async function fetchPersonalizedExploreBundleImpl(
  preferences: UserPreferences,
  excludeMovieIds: string[]
): Promise<PersonalizedExploreBundle | null> {
  try {
    const res = await fetch("/api/explore/personalized", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        preferences,
        bundle: true,
        excludeMovieIds,
      }),
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
  return sortContentItemsByPreferenceRank(filtered, preferences);
}

function interleaveTrending(
  movies: ContentItem[],
  tv: ContentItem[],
  maxItems: number
): ContentItem[] {
  const out: ContentItem[] = [];
  const n = Math.max(movies.length, tv.length);
  for (let i = 0; i < n && out.length < maxItems; i++) {
    if (i < movies.length && out.length < maxItems) {
      out.push({ ...movies[i], type: movies[i].type ?? "movie" });
    }
    if (i < tv.length && out.length < maxItems) {
      out.push({ ...tv[i], type: tv[i].type ?? "tv" });
    }
  }
  return out;
}

/** Spotlight carousel: preference-ranked when signed in, movie/TV interleave for guests. */
export function buildSpotlightItems(
  movies: ContentItem[],
  tv: ContentItem[],
  preferences: UserPreferences | null,
  maxItems = 24
): ContentItem[] {
  if (!preferences || !hasUserPreferences(preferences)) {
    return interleaveTrending(movies, tv, maxItems);
  }

  const merged: ContentItem[] = [
    ...movies.map((item) => ({ ...item, type: item.type ?? "movie" })),
    ...tv.map((item) => ({ ...item, type: item.type ?? "tv" })),
  ];

  return sortContentItemsByPreferenceRank(
    merged.filter((item) => contentItemMatchesPreferences(item, preferences)),
    preferences
  ).slice(0, maxItems);
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

const exploreCoreInflight = new Map<string, Promise<ExploreCorePayload>>();

function exploreCoreCacheKey(
  preferences: UserPreferences | null,
  excludeMovieIds: string[]
): string {
  return JSON.stringify({
    p: preferences,
    e: [...excludeMovieIds].sort(),
  });
}

export function bustExploreCoreInflight(
  preferences: UserPreferences | null,
  excludeMovieIds: string[] = []
): void {
  exploreCoreInflight.delete(exploreCoreCacheKey(preferences, excludeMovieIds));
}

export async function loadExploreCorePayload(
  preferences: UserPreferences | null,
  options?: { excludeMovieIds?: string[] }
): Promise<ExploreCorePayload> {
  const excludeMovieIds = options?.excludeMovieIds ?? [];
  const inflightKey = exploreCoreCacheKey(preferences, excludeMovieIds);
  const existing = exploreCoreInflight.get(inflightKey);
  if (existing) return existing;

  const promise = (async () => {
  const [bundle, feed, personalized] = await Promise.all([
    fetchExploreBundle(),
    fetchDiscoverFeed(),
    fetchPersonalizedExploreBundle(preferences, excludeMovieIds),
  ]);

  const excludeSet = new Set(excludeMovieIds.map(String));
  const personalizedRecommended = (personalized?.recommended ?? []).filter(
    (item) => !(item.type === "movie" && excludeSet.has(String(item.id)))
  );

  let recommendedRows = filterRailByPreferences(
    personalizedRecommended,
    preferences
  );

  if (recommendedRows.length === 0 && hasUserPreferences(preferences)) {
    recommendedRows = buildSpotlightItems(
      bundle.discover.trendingMovies,
      bundle.discover.trendingTv,
      preferences,
      24
    ).filter(
      (item) => !(item.type === "movie" && excludeSet.has(String(item.id)))
    );
  }

  return {
    discover: buildDiscoverFromPersonalized(bundle, personalized, preferences),
    genres: bundle.genres,
    recommendedRows,
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
  })().finally(() => {
    exploreCoreInflight.delete(inflightKey);
  });

  exploreCoreInflight.set(inflightKey, promise);
  return promise;
}

export async function loadExplorePagePayload(
  historyEntries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string,
  options?: {
    watchLaterEntries?: { catalogId: string; mediaType: "movie" | "tv" }[];
    favoriteEntries?: { catalogId: string; mediaType: "movie" | "tv" }[];
    preferences?: UserPreferences | null;
    excludeMovieIds?: string[];
  }
): Promise<ExplorePagePayload> {
  const watchLaterEntries = options?.watchLaterEntries ?? [];
  const favoriteEntries = options?.favoriteEntries ?? [];
  const preferences = options?.preferences ?? null;

  const [core, rails] = await Promise.all([
    loadExploreCorePayload(preferences, {
      excludeMovieIds: options?.excludeMovieIds,
    }),
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
