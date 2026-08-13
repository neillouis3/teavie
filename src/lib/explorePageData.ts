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
  peekExploreBundleCache,
  type ExploreBundle,
  type TmdbDiscoverPayload,
} from "@/lib/pageDataCache";

export type { TmdbDiscoverPayload };

const EMPTY_FEED = {
  newContent: [] as ContentItem[],
  updatedContent: [] as ContentItem[],
  upcomingContent: [] as ContentItem[],
};

const EXPLORE_HISTORY_CACHE_PREFIX = "teavie.cache.explore.history.v3:";

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

/** True when two catalog ids refer to the same title (e.g. anime MAL aliases). */
export function catalogIdsMatch(
  catalogId: string,
  itemId: string | number
): boolean {
  const left = String(catalogId ?? "").trim();
  const right = String(itemId ?? "").trim();
  if (!left || !right) return false;
  if (left === right) return true;
  if (left === `anime_${right}` || right === `anime_${left}`) return true;
  return false;
}

export function historyRowsCoverEntries(
  rows: ExploreHistoryRow[],
  entries: WatchHistoryEntry[]
): boolean {
  if (entries.length === 0) return true;
  if (rows.length === 0) return false;
  return entries.every((entry) =>
    rows.some((row) => catalogIdsMatch(entry.catalogId, row.id))
  );
}

function mergeHistoryRows(
  cached: ExploreHistoryRow[],
  entries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string
): ExploreHistoryRow[] {
  const out: ExploreHistoryRow[] = [];
  for (const entry of entries) {
    const row = cached.find((candidate) =>
      catalogIdsMatch(entry.catalogId, candidate.id)
    );
    if (!row) continue;
    out.push({
      ...row,
      id: entry.catalogId,
      lastSeason: entry.lastSeason,
      lastEpisode: entry.lastEpisode,
      progressLabel: progressLabel(entry),
    });
  }
  return out;
}

/** Synchronous cache read for instant continue-watching rails on revisit. */
export function peekExploreHistoryRows(
  entries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string
): ExploreHistoryRow[] {
  if (entries.length === 0) return [];
  const cached = readClientDayCache<ExploreHistoryRow[]>(historyCacheKey(entries));
  if (!cached?.length) return [];
  return mergeHistoryRows(cached, entries, progressLabel);
}

export function exploreHistoryRowsMatch(
  a: ExploreHistoryRow[],
  b: ExploreHistoryRow[]
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (String(left.id) !== String(right.id)) return false;
    if (left.progressLabel !== right.progressLabel) return false;
    if (left.lastSeason !== right.lastSeason) return false;
    if (left.lastEpisode !== right.lastEpisode) return false;
  }
  return true;
}

export function peekExploreUserRails(
  historyEntries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string
): UserRailRows {
  return {
    historyRows: peekExploreHistoryRows(historyEntries, progressLabel),
    watchLaterRows: [],
    favoriteRows: [],
  };
}

const historyRowsInflight = new Map<string, Promise<ExploreHistoryRow[]>>();

async function fetchExploreHistoryRowsImpl(
  entries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string,
  cacheKey: string,
  cached: ExploreHistoryRow[] | null
): Promise<ExploreHistoryRow[]> {
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
    if (!res.ok) return cached?.length ? mergeHistoryRows(cached, entries, progressLabel) : [];
    const json = (await res.json()) as { items?: ContentItem[] };
    const byId = new Map((json.items ?? []).map((item) => [String(item.id), item]));
    const rows: ExploreHistoryRow[] = [];
    for (const entry of entries) {
      const item =
        byId.get(entry.catalogId) ??
        (json.items ?? []).find((row) =>
          catalogIdsMatch(entry.catalogId, row.id)
        );
      if (!item) continue;
      rows.push({
        ...item,
        id: entry.catalogId,
        progressLabel: progressLabel(entry),
        lastSeason: entry.lastSeason,
        lastEpisode: entry.lastEpisode,
      });
    }
    if (rows.length > 0) {
      writeClientDayCache(cacheKey, rows);
    }
    return rows;
  } catch {
    return cached?.length ? mergeHistoryRows(cached, entries, progressLabel) : [];
  }
}

export async function fetchExploreHistoryRows(
  entries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string
): Promise<ExploreHistoryRow[]> {
  if (entries.length === 0) return [];

  const cacheKey = historyCacheKey(entries);
  const cached = readClientDayCache<ExploreHistoryRow[]>(cacheKey);
  if (cached && cached.length > 0) {
    const merged = mergeHistoryRows(cached, entries, progressLabel);
    if (historyRowsCoverEntries(merged, entries)) return merged;
  }

  const inflight = historyRowsInflight.get(cacheKey);
  if (inflight) return inflight;

  const promise = fetchExploreHistoryRowsImpl(
    entries,
    progressLabel,
    cacheKey,
    cached
  ).finally(() => {
    historyRowsInflight.delete(cacheKey);
  });
  historyRowsInflight.set(cacheKey, promise);
  return promise;
}

/** Rebuild history rows from existing rail data (no network). Returns null if a new title needs fetch. */
export function projectExploreHistoryRows(
  existingRows: ExploreHistoryRow[],
  entries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string
): ExploreHistoryRow[] | null {
  if (entries.length === 0) return [];
  if (
    !entries.every((entry) =>
      existingRows.some((row) => catalogIdsMatch(entry.catalogId, row.id))
    )
  ) {
    return null;
  }
  return entries.map((entry) => {
    const row = existingRows.find((candidate) =>
      catalogIdsMatch(entry.catalogId, candidate.id)
    )!;
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
  excludeMovieIds: string[] = [],
  recommendedOnly = false
): Promise<PersonalizedExploreBundle | null> {
  if (!preferences || !hasUserPreferences(preferences)) return null;
  const excludeKey = [...excludeMovieIds].map(String).sort().join("|");
  const key = `${JSON.stringify(preferences)}::${excludeKey}::${recommendedOnly ? "rec" : "full"}`;
  const inflight = personalizedInflight.get(key);
  if (inflight) return inflight;

  const promise = fetchPersonalizedExploreBundleImpl(
    preferences,
    excludeMovieIds,
    recommendedOnly
  ).finally(() => {
    personalizedInflight.delete(key);
  });
  personalizedInflight.set(key, promise);
  return promise;
}

const personalizedInflight = new Map<string, Promise<PersonalizedExploreBundle | null>>();

const PERSONALIZED_BUNDLE_CACHE_PREFIX = "teavie.cache.personalized-explore.v2:";

function personalizedBundleCacheKey(
  preferences: UserPreferences,
  excludeMovieIds: string[]
): string {
  return `${PERSONALIZED_BUNDLE_CACHE_PREFIX}${JSON.stringify(preferences)}::${[...excludeMovieIds].sort().join("|")}`;
}

export function peekPersonalizedExploreCache(
  preferences: UserPreferences | null,
  excludeMovieIds: string[] = []
): PersonalizedExploreBundle | null {
  if (!preferences || !hasUserPreferences(preferences)) return null;
  return readClientDayCache<PersonalizedExploreBundle>(
    personalizedBundleCacheKey(preferences, excludeMovieIds)
  );
}

function readPersonalizedBundleCache(
  preferences: UserPreferences,
  excludeMovieIds: string[]
): PersonalizedExploreBundle | null {
  return peekPersonalizedExploreCache(preferences, excludeMovieIds);
}

function writePersonalizedBundleCache(
  preferences: UserPreferences,
  excludeMovieIds: string[],
  bundle: PersonalizedExploreBundle
): void {
  writeClientDayCache(
    personalizedBundleCacheKey(preferences, excludeMovieIds),
    bundle
  );
}

async function fetchPersonalizedExploreBundleImpl(
  preferences: UserPreferences,
  excludeMovieIds: string[],
  recommendedOnly = false
): Promise<PersonalizedExploreBundle | null> {
  const cached = recommendedOnly
    ? null
    : readPersonalizedBundleCache(preferences, excludeMovieIds);
  if (cached) return cached;

  try {
    const res = await fetch("/api/explore/personalized", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        preferences,
        bundle: true,
        recommendedOnly,
        excludeMovieIds,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      bundle?: PersonalizedExploreBundle | null;
    };
    const bundle = json.bundle ?? null;
    if (bundle && !recommendedOnly) {
      writePersonalizedBundleCache(preferences, excludeMovieIds, bundle);
    }
    return bundle;
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

  const filtered = sortContentItemsByPreferenceRank(
    merged.filter((item) => contentItemMatchesPreferences(item, preferences)),
    preferences
  ).slice(0, maxItems);

  if (filtered.length > 0) return filtered;
  return interleaveTrending(movies, tv, maxItems);
}

function buildDiscoverFromPersonalized(
  bundle: ExploreBundle,
  personalized: PersonalizedExploreBundle | null,
  preferences: UserPreferences | null
): TmdbDiscoverPayload {
  if (!personalized) return bundle.discover;

  const popularMovies = filterRailByPreferences(
    personalized.popularMovies,
    preferences
  );
  const popularTv = filterRailByPreferences(
    personalized.popularTv,
    preferences
  );

  const pickRail = (personalizedItems: ContentItem[], fallbackItems: ContentItem[]) =>
    personalizedItems.length > 0 ? personalizedItems : fallbackItems;

  // Keep spotlight/trending on the stable explore bundle — personalized rows
  // live in recommendedRows so the hero does not swap mid-load.
  return {
    ...bundle.discover,
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

export function peekExploreCoreCache(): ExploreCorePayload | null {
  const bundle = peekExploreBundleCache();
  if (!bundle) return null;
  const feed = bundle.feed ?? EMPTY_FEED;
  return buildCoreFromBundle(bundle, feed);
}

/** Instant Explore paint from day cache (shell + personalized when available). */
export function peekExploreInitialCore(
  preferences: UserPreferences | null,
  excludeMovieIds: string[] = []
): ExploreCorePayload | null {
  const bundle = peekExploreBundleCache();
  if (!bundle) return null;
  const feed = bundle.feed ?? EMPTY_FEED;
  const shell = buildCoreFromBundle(bundle, feed);
  if (!preferences || !hasUserPreferences(preferences)) return shell;
  const personalized = peekPersonalizedExploreCache(preferences, excludeMovieIds);
  if (!personalized) return shell;
  return applyPersonalizedToCore(
    shell,
    bundle,
    personalized,
    preferences,
    excludeMovieIds
  );
}

function buildCoreFromBundle(
  bundle: ExploreBundle,
  feed: { newContent: ContentItem[]; upcomingContent: ContentItem[] }
): ExploreCorePayload {
  return {
    discover: bundle.discover,
    genres: bundle.genres,
    recommendedRows: [],
    newContent: feed.newContent,
    upcomingContent: feed.upcomingContent,
    personalized: null,
  };
}

export function applyPersonalizedToCore(
  shell: ExploreCorePayload,
  bundle: ExploreBundle,
  personalized: PersonalizedExploreBundle | null,
  preferences: UserPreferences | null,
  excludeMovieIds: string[]
): ExploreCorePayload {
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

  const feed = bundle.feed;

  return {
    discover: buildDiscoverFromPersonalized(bundle, personalized, preferences),
    genres: bundle.genres,
    recommendedRows,
    newContent:
      personalized?.newContent.length
        ? filterRailByPreferences(personalized.newContent, preferences)
        : feed?.newContent ?? shell.newContent,
    upcomingContent:
      personalized?.upcomingContent.length
        ? filterRailByPreferences(personalized.upcomingContent, preferences)
        : feed?.upcomingContent ?? shell.upcomingContent,
    personalized,
  };
}

/** Fast path: cached explore bundle + embedded feed (no personalized). */
export async function loadExploreCoreShell(): Promise<ExploreCorePayload> {
  const bundle = await fetchExploreBundle();
  const feed = bundle.feed ?? (await fetchDiscoverFeed());
  return buildCoreFromBundle(bundle, feed);
}

/** Apply preference-personalized rails onto an already-loaded shell. */
export async function enrichExploreCoreWithPreferences(
  shell: ExploreCorePayload,
  preferences: UserPreferences | null,
  excludeMovieIds: string[] = []
): Promise<ExploreCorePayload> {
  if (!preferences || !hasUserPreferences(preferences)) return shell;
  const [bundle, personalized] = await Promise.all([
    fetchExploreBundle(),
    fetchPersonalizedExploreBundle(preferences, excludeMovieIds, false),
  ]);
  return applyPersonalizedToCore(
    shell,
    bundle,
    personalized,
    preferences,
    excludeMovieIds
  );
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
    const bundle = await fetchExploreBundle();
    const feed =
      bundle.feed ??
      (await fetchDiscoverFeed().catch(() => ({
        newContent: [] as ContentItem[],
        updatedContent: [] as ContentItem[],
        upcomingContent: [] as ContentItem[],
      })));
    const shell = buildCoreFromBundle(bundle, feed);

    if (!preferences || !hasUserPreferences(preferences)) {
      return shell;
    }

    const personalized = await fetchPersonalizedExploreBundle(
      preferences,
      excludeMovieIds
    );
    return applyPersonalizedToCore(
      shell,
      bundle,
      personalized,
      preferences,
      excludeMovieIds
    );
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
