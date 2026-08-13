import type { ContentItem } from "@/types/content";
import type { CatalogGenreRow } from "@/components/genre/genreTileShared";
import { readClientDayCache, writeClientDayCache } from "@/lib/clientDayCache";
import type { UserPreferences } from "@/types/user";
import { hasUserPreferences } from "@/types/user";

const PREFIX = "teavie.cache";

function preferencesCacheKey(preferences: UserPreferences | null | undefined): string {
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

  const data = await fetcher();
  if (!options?.isCacheable || options.isCacheable(data)) {
    writeClientDayCache(key, data);
  }
  return data;
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
    hasCatalogItems(data.new) ||
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
  new: ContentItem[];
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
};

export type BrowseCatalogPageResults = {
  results: ContentItem[];
  totalPages?: number;
  total?: number;
};

const EMPTY_CATEGORY: CategoryDiscoverPayload = {
  featured: [],
  trending: [],
  popular: [],
  topRated: [],
  new: [],
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
};

const EMPTY_DISCOVER: TmdbDiscoverPayload = {
  trendingMovies: [],
  trendingTv: [],
  popularMovies: [],
  popularTv: [],
};

export async function fetchExploreBundle(): Promise<ExploreBundle> {
  return withDayCache(
    `${PREFIX}.explore.bundle.v1`,
    async () => {
      try {
        const res = await fetch("/api/explore");
        if (!res.ok) {
          return { discover: EMPTY_DISCOVER, genres: [] };
        }
        const data = await res.json();
        return {
          discover: {
            trendingMovies: data.discover?.trendingMovies ?? [],
            trendingTv: data.discover?.trendingTv ?? [],
            popularMovies: data.discover?.popularMovies ?? [],
            popularTv: data.discover?.popularTv ?? [],
          },
          genres: Array.isArray(data.genres) ? data.genres : [],
        };
      } catch {
        return { discover: EMPTY_DISCOVER, genres: [] };
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
      new: json.new ?? [],
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
  const prefKey = preferencesCacheKey(preferences);
  return withDayCache(
    `${PREFIX}.category-discover.v4:${slug}:${prefKey}`,
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

export async function fetchGenresIndex(): Promise<CatalogGenreRow[]> {
  return withDayCache(`${PREFIX}.genres-index.v1:name`, async () => {
    const bundle = await fetchExploreBundle();
    return [...bundle.genres].sort((a, b) => a.name.localeCompare(b.name));
  });
}

export async function fetchGenrePagePayload(
  slug: string,
  type: "all" | "movie" | "tv",
  preferences: UserPreferences | null = null
): Promise<GenrePagePayload> {
  const prefKey = preferencesCacheKey(preferences);
  return withDayCache(
    `${PREFIX}.genre-page.v2:${slug}:${type}:${prefKey}`,
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
  const listRes = await fetch(`${apiPath}?${queryString}`);
  if (!listRes.ok) {
    return { results: [] };
  }
  const listJson = await listRes.json();
  return {
    results: listJson.results ?? [],
    totalPages:
      typeof listJson.totalPages === "number" ? listJson.totalPages : undefined,
    total: typeof listJson.total === "number" ? listJson.total : undefined,
  };
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

export async function fetchBrowseCatalogPayload(
  namespace: string,
  apiPath: string,
  queryString: string,
  genreApiPath?: string
): Promise<BrowseCatalogPayload> {
  const cacheKey = `${PREFIX}.browse.v4:${namespace}:${queryString}`;
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

        if (listData.results.length === 0 && !listData.total) {
          return { results: [], totalPages: 1, total: 0, genreSlugs };
        }

        return {
          results: listData.results,
          totalPages: listData.totalPages ?? 1,
          total: listData.total ?? 0,
          genreSlugs,
        };
      } catch {
        return { results: [], totalPages: 1, total: 0, genreSlugs: undefined };
      }
    },
    {
      // Cache real pages (including legitimately empty filtered views that still
      // report a total / genre list). Never stick a hard network failure.
      isCacheable: (data) =>
        hasCatalogItems(data.results) ||
        (typeof data.total === "number" && data.total > 0) ||
        (Array.isArray(data.genreSlugs) && data.genreSlugs.length > 0),
    }
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
