import type { ContentItem } from "@/types/content";
import type { CatalogGenreRow } from "@/components/genre/genreTileShared";
import { readClientDayCache, writeClientDayCache } from "@/lib/clientDayCache";
import type { UserPreferences } from "@/types/user";
import { hasUserPreferences } from "@/types/user";

const PREFIX = "teavie.cache";

export function preferencesCacheKey(preferences: UserPreferences | null | undefined): string {
  if (!preferences || !hasUserPreferences(preferences)) return "default";
  const sorted = {
    c: [...preferences.categories].sort(),
    g: [...preferences.genres].sort(),
    l: [...preferences.languages].sort(),
  };
  return JSON.stringify(sorted);
}

type DayCacheOptions<T> = {
  /**
   * When set, only successful payloads are stored / reused.
   * Failed or empty responses stay uncached so the next visit can recover.
   */
  isCacheable?: (data: T) => boolean;
};

/** In-flight fetches keyed by cache key — remounts share the same promise. */
const inflightDayCache = new Map<string, Promise<unknown>>();

/** Drop a stuck in-flight fetch (e.g. after returning from a background tab). */
export function bustInflightDayCache(key: string): void {
  inflightDayCache.delete(key);
}

async function withDayCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: DayCacheOptions<T>
): Promise<T> {
  const cached = readClientDayCache<T>(key);
  if (cached != null) {
    if (!options?.isCacheable || options.isCacheable(cached)) {
      return cached;
    }
    // Drop poisoned empty/error entries from earlier failed loads.
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(key);
      } catch {
        /* private mode */
      }
    }
  }

  const inflight = inflightDayCache.get(key);
  if (inflight) {
    return inflight as Promise<T>;
  }

  const promise = (async () => {
    const data = await fetcher();
    if (!options?.isCacheable || options.isCacheable(data)) {
      writeClientDayCache(key, data);
    }
    return data;
  })().finally(() => {
    inflightDayCache.delete(key);
  });

  inflightDayCache.set(key, promise);
  return promise;
}

function hasCatalogItems(items: ContentItem[] | undefined | null): boolean {
  return Array.isArray(items) && items.length > 0;
}

function isCategoryDiscoverCacheable(data: CategoryDiscoverPayload): boolean {
  return (
    hasCatalogItems(data.featured) ||
    hasCatalogItems(data.trending) ||
    hasCatalogItems(data.popular) ||
    hasCatalogItems(data.topRated) ||
    hasCatalogItems(data.newEpisodes) ||
    (Array.isArray(data.genres) && data.genres.some((g) => (g.count ?? 0) > 0))
  );
}

function isExploreBundleCacheable(data: ExploreBundle): boolean {
  const d = data.discover;
  return (
    hasCatalogItems(d?.trendingMovies) ||
    hasCatalogItems(d?.trendingTv) ||
    hasCatalogItems(d?.popularMovies) ||
    hasCatalogItems(d?.popularTv) ||
    (Array.isArray(data.genres) && data.genres.length > 0)
  );
}

function isGenrePageCacheable(data: GenrePagePayload): boolean {
  return (
    hasCatalogItems(data.featured) ||
    hasCatalogItems(data.rails?.popular) ||
    hasCatalogItems(data.rails?.top_rated) ||
    hasCatalogItems(data.rails?.new) ||
    (typeof data.total === "number" && data.total > 0)
  );
}

function isDiscoverFeedCacheable(data: DiscoverFeedPayload): boolean {
  return (
    hasCatalogItems(data.newContent) ||
    hasCatalogItems(data.updatedContent) ||
    hasCatalogItems(data.upcomingContent)
  );
}

function isCatalogStatsCacheable(data: CatalogStatsPayload): boolean {
  return typeof data.total === "number" && data.total > 0;
}

export type DiscoverFeedPayload = {
  newContent: ContentItem[];
  updatedContent: ContentItem[];
  upcomingContent: ContentItem[];
};

export type CategoryDiscoverPayload = {
  featured: ContentItem[];
  trending: ContentItem[];
  popular: ContentItem[];
  topRated: ContentItem[];
  newEpisodes: ContentItem[];
  genres: CatalogGenreRow[];
};

export type GenrePageRails = {
  popular: ContentItem[];
  top_rated: ContentItem[];
  new: ContentItem[];
};

export type GenrePagePayload = {
  featured: ContentItem[];
  total: number;
  rails: GenrePageRails;
};

export type BrowseCatalogPayload = {
  results: ContentItem[];
  totalPages: number;
  total: number;
  genreSlugs?: string[];
  ok?: boolean;
};

export type BrowseCatalogPageResults = {
  results: ContentItem[];
  totalPages?: number;
  total?: number;
  ok?: boolean;
};

const EMPTY_CATEGORY: CategoryDiscoverPayload = {
  featured: [],
  trending: [],
  popular: [],
  topRated: [],
  newEpisodes: [],
  genres: [],
};

const EMPTY_GENRE_RAILS: GenrePageRails = {
  popular: [],
  top_rated: [],
  new: [],
};

export async function fetchDiscoverFeed(): Promise<DiscoverFeedPayload> {
  return withDayCache(
    `${PREFIX}.discover-feed.v1`,
    async () => {
      try {
        const res = await fetch("/api/discover/feed");
        if (!res.ok) {
          return { newContent: [], updatedContent: [], upcomingContent: [] };
        }
        const data = await res.json();
        return {
          newContent: data.newContent ?? [],
          updatedContent: data.updatedContent ?? [],
          upcomingContent: data.upcomingContent ?? [],
        };
      } catch {
        return { newContent: [], updatedContent: [], upcomingContent: [] };
      }
    },
    { isCacheable: isDiscoverFeedCacheable }
  );
}

export type TmdbDiscoverPayload = {
  trendingMovies: ContentItem[];
  trendingTv: ContentItem[];
  popularMovies: ContentItem[];
  popularTv: ContentItem[];
};

export type ExploreBundle = {
  discover: TmdbDiscoverPayload;
  genres: CatalogGenreRow[];
  feed?: DiscoverFeedPayload;
};

const EMPTY_DISCOVER: TmdbDiscoverPayload = {
  trendingMovies: [],
  trendingTv: [],
  popularMovies: [],
  popularTv: [],
};

const EMPTY_FEED: DiscoverFeedPayload = {
  newContent: [],
  updatedContent: [],
  upcomingContent: [],
};

function parseExploreApiPayload(data: Record<string, unknown>): ExploreBundle {
  const discover = data.discover as Record<string, unknown> | undefined;
  const feedRaw = data.feed as Record<string, unknown> | undefined;
  return {
    discover: {
      trendingMovies: (discover?.trendingMovies as ContentItem[]) ?? [],
      trendingTv: (discover?.trendingTv as ContentItem[]) ?? [],
      popularMovies: (discover?.popularMovies as ContentItem[]) ?? [],
      popularTv: (discover?.popularTv as ContentItem[]) ?? [],
    },
    genres: Array.isArray(data.genres) ? (data.genres as CatalogGenreRow[]) : [],
    feed: feedRaw
      ? {
          newContent: (feedRaw.newContent as ContentItem[]) ?? [],
          updatedContent: (feedRaw.updatedContent as ContentItem[]) ?? [],
          upcomingContent: (feedRaw.upcomingContent as ContentItem[]) ?? [],
        }
      : undefined,
  };
}

export function peekExploreBundleCache(): ExploreBundle | null {
  const cached = readClientDayCache<ExploreBundle>(`${PREFIX}.explore.bundle.v2`);
  if (cached && isExploreBundleCacheable(cached)) return cached;
  return null;
}

export async function fetchExploreBundle(): Promise<ExploreBundle> {
  return withDayCache(
    `${PREFIX}.explore.bundle.v2`,
    async () => {
      try {
        const res = await fetch("/api/explore");
        if (!res.ok) {
          return { discover: EMPTY_DISCOVER, genres: [], feed: EMPTY_FEED };
        }
        const data = (await res.json()) as Record<string, unknown>;
        return parseExploreApiPayload(data);
      } catch {
        return { discover: EMPTY_DISCOVER, genres: [], feed: EMPTY_FEED };
      }
    },
    { isCacheable: isExploreBundleCacheable }
  );
}

async function loadCategoryDiscover(
  slug: string,
  preferences: UserPreferences | null
): Promise<CategoryDiscoverPayload> {
  try {
    const res = hasUserPreferences(preferences)
      ? await fetch(`/api/category/${slug}/discover`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ preferences }),
        })
      : await fetch(`/api/category/${slug}/discover`);
    if (!res.ok) return EMPTY_CATEGORY;
    const json = await res.json();
    return {
      featured: json.featured ?? [],
      trending: json.trending ?? [],
      popular: json.popular ?? [],
      topRated: json.topRated ?? [],
      newEpisodes: json.newEpisodes ?? [],
      genres: json.genres ?? [],
    };
  } catch {
    return EMPTY_CATEGORY;
  }
}

export async function fetchCategoryDiscover(
  slug: string,
  preferences: UserPreferences | null = null
): Promise<CategoryDiscoverPayload> {
  return withDayCache(
    categoryDiscoverCacheKey(slug, preferences),
    async () => {
      const first = await loadCategoryDiscover(slug, preferences);
      if (isCategoryDiscoverCacheable(first)) return first;
      // One quick retry on empty/failed loads so a blip does not blank the hub.
      await new Promise((r) => setTimeout(r, 400));
      return loadCategoryDiscover(slug, preferences);
    },
    { isCacheable: isCategoryDiscoverCacheable }
  );
}

export function categoryDiscoverCacheKey(
  slug: string,
  preferences: UserPreferences | null = null
): string {
  return `${PREFIX}.category-discover.v13:${slug}:${preferencesCacheKey(preferences)}`;
}

export function peekCategoryDiscoverCache(
  slug: string,
  preferences: UserPreferences | null = null
): CategoryDiscoverPayload | null {
  const cached = readClientDayCache<CategoryDiscoverPayload>(
    categoryDiscoverCacheKey(slug, preferences)
  );
  if (cached && isCategoryDiscoverCacheable(cached)) return cached;
  return null;
}

export async function fetchGenresIndex(): Promise<CatalogGenreRow[]> {
  return withDayCache(`${PREFIX}.genres-index.v1:name`, async () => {
    const bundle = await fetchExploreBundle();
    return [...bundle.genres].sort((a, b) => a.name.localeCompare(b.name));
  });
}

export function genrePageCacheKey(
  slug: string,
  type: "all" | "movie" | "tv",
  preferences: UserPreferences | null = null
): string {
  return `${PREFIX}.genre-page.v2:${slug}:${type}:${preferencesCacheKey(preferences)}`;
}

export function peekGenrePageCache(
  slug: string,
  type: "all" | "movie" | "tv",
  preferences: UserPreferences | null = null
): GenrePagePayload | null {
  const cached = readClientDayCache<GenrePagePayload>(
    genrePageCacheKey(slug, type, preferences)
  );
  if (cached && isGenrePageCacheable(cached)) return cached;
  return null;
}

export async function fetchGenrePagePayload(
  slug: string,
  type: "all" | "movie" | "tv",
  preferences: UserPreferences | null = null
): Promise<GenrePagePayload> {
  return withDayCache(
    genrePageCacheKey(slug, type, preferences),
    async () => {
      try {
        const res = hasUserPreferences(preferences)
          ? await fetch("/api/genre/page", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ slug, type, limit: 24, preferences }),
            })
          : await fetch(
              `/api/genre/page?${new URLSearchParams({
                slug,
                limit: "24",
                ...(type !== "all" ? { type } : {}),
              }).toString()}`
            );
        if (!res.ok) {
          return { featured: [], total: 0, rails: EMPTY_GENRE_RAILS };
        }
        const data = await res.json();
        return {
          featured: data.featured ?? [],
          total: typeof data.total === "number" ? data.total : 0,
          rails: {
            popular: data.rails?.popular ?? [],
            top_rated: data.rails?.top_rated ?? [],
            new: data.rails?.new ?? [],
          },
        };
      } catch {
        return { featured: [], total: 0, rails: EMPTY_GENRE_RAILS };
      }
    },
    { isCacheable: isGenrePageCacheable }
  );
}

export async function fetchBrowseCatalogGenres(
  namespace: string,
  genreApiPath: string
): Promise<string[] | undefined> {
  return withDayCache(`${PREFIX}.browse-genres.v1:${namespace}`, async () => {
    try {
      const genreRes = await fetch(genreApiPath);
      const genreJson = genreRes.ok ? await genreRes.json() : { genres: [] };
      return (genreJson.genres ?? [])
        .filter((g: { count?: number }) => (g.count ?? 0) > 0)
        .map((g: { slug: string }) => g.slug);
    } catch {
      return undefined;
    }
  });
}

async function loadBrowseCatalogList(
  apiPath: string,
  queryString: string
): Promise<BrowseCatalogPageResults> {
  try {
    const listRes = await fetch(`${apiPath}?${queryString}`);
    if (!listRes.ok) {
      return { results: [], ok: false };
    }
    const listJson = await listRes.json();
    return {
      results: listJson.results ?? [],
      totalPages:
        typeof listJson.totalPages === "number" ? listJson.totalPages : undefined,
      total: typeof listJson.total === "number" ? listJson.total : undefined,
      ok: true,
    };
  } catch {
    return { results: [], ok: false };
  }
}

function isBrowsePayloadCacheable(data: BrowseCatalogPayload): boolean {
  return (
    hasCatalogItems(data.results) ||
    (typeof data.total === "number" && data.total > 0)
  );
}

export async function fetchBrowseCatalogPageResults(
  namespace: string,
  apiPath: string,
  queryString: string
): Promise<BrowseCatalogPageResults> {
  const cacheKey = `${PREFIX}.browse-page.v1:${namespace}:${queryString}`;
  return withDayCache(
    cacheKey,
    () => loadBrowseCatalogList(apiPath, queryString),
    { isCacheable: (data) => hasCatalogItems(data.results) }
  );
}

/** Warm the next browse page in the background (no-op if already cached). */
export function prefetchBrowseCatalogPage(
  namespace: string,
  apiPath: string,
  filterQueryString: string,
  page: number
): void {
  if (page < 2 || typeof window === "undefined") return;
  const query = new URLSearchParams(filterQueryString);
  query.set("page", String(page));
  void fetchBrowseCatalogPageResults(namespace, apiPath, query.toString());
}

export function browseCatalogCacheKey(
  namespace: string,
  queryString: string
): string {
  return `${PREFIX}.browse.v11:${namespace}:${queryString}`;
}

export function peekBrowseCatalogCache(
  namespace: string,
  queryString: string
): BrowseCatalogPayload | null {
  const cached = readClientDayCache<BrowseCatalogPayload>(
    browseCatalogCacheKey(namespace, queryString)
  );
  if (cached && isBrowsePayloadCacheable(cached)) return cached;
  return null;
}

export async function fetchBrowseCatalogPayload(
  namespace: string,
  apiPath: string,
  queryString: string,
  genreApiPath?: string
): Promise<BrowseCatalogPayload> {
  const cacheKey = browseCatalogCacheKey(namespace, queryString);
  const page = new URLSearchParams(queryString).get("page") || "1";
  const isFirstPage = page === "1";

  return withDayCache(
    cacheKey,
    async () => {
      try {
        const [listData, genreSlugs] = await Promise.all([
          loadBrowseCatalogList(apiPath, queryString),
          isFirstPage && genreApiPath
            ? fetchBrowseCatalogGenres(namespace, genreApiPath)
            : Promise.resolve(undefined),
        ]);

        if (listData.ok === false) {
          throw new Error("browse list failed");
        }

        if (listData.results.length === 0 && listData.total === undefined) {
          throw new Error("browse list incomplete");
        }

        return {
          results: listData.results,
          totalPages: listData.totalPages ?? 1,
          total: listData.total ?? 0,
          genreSlugs,
          ok: true,
        };
      } catch {
        return {
          results: [],
          totalPages: 1,
          total: 0,
          genreSlugs: undefined,
          ok: false,
        };
      }
    },
    { isCacheable: isBrowsePayloadCacheable }
  );
}

export type SearchPopularPayload = {
  popularMovies: ContentItem[];
  popularTv: ContentItem[];
};

export type SearchResultsPayload = {
  results: ContentItem[];
  total: number;
  totalPages: number;
};

export async function fetchSearchPopular(
  limit = 20
): Promise<SearchPopularPayload> {
  return withDayCache(`${PREFIX}.search-popular.v1:${limit}`, async () => {
    const bundle = await fetchExploreBundle();
    return {
      popularMovies: bundle.discover.popularMovies.slice(0, limit),
      popularTv: bundle.discover.popularTv.slice(0, limit),
    };
  });
}

export async function fetchSearchResults(
  queryString: string
): Promise<SearchResultsPayload> {
  const res = await fetch(`/api/search?${queryString}`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw new Error(
      typeof data?.message === "string" && data.message.trim()
        ? data.message
        : "Search is temporarily unavailable. Try again in a moment."
    );
  }
  return {
    results: data.results ?? [],
    total: typeof data.total === "number" ? data.total : 0,
    totalPages: typeof data.totalPages === "number" ? data.totalPages : 0,
  };
}

export type CatalogStatsPayload = {
  movies: number;
  tv: number;
  anime: number;
  kdrama: number;
  total: number;
};

const EMPTY_CATALOG_STATS: CatalogStatsPayload = {
  movies: 0,
  tv: 0,
  anime: 0,
  kdrama: 0,
  total: 0,
};

export async function fetchCatalogStats(): Promise<CatalogStatsPayload> {
  return withDayCache(
    `${PREFIX}.catalog-stats.v1`,
    async () => {
      try {
        const res = await fetch("/api/catalog/stats");
        if (!res.ok) return EMPTY_CATALOG_STATS;
        const data = await res.json();
        return {
          movies: typeof data.movies === "number" ? data.movies : 0,
          tv: typeof data.tv === "number" ? data.tv : 0,
          anime: typeof data.anime === "number" ? data.anime : 0,
          kdrama: typeof data.kdrama === "number" ? data.kdrama : 0,
          total: typeof data.total === "number" ? data.total : 0,
        };
      } catch {
        return EMPTY_CATALOG_STATS;
      }
    },
    { isCacheable: isCatalogStatsCacheable }
  );
}
