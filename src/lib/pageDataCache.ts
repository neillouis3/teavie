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
    isCategoryHeroCacheable(data) ||
    isCategoryRailsCacheable(data)
  );
}

function isCategoryHeroCacheable(
  data: Pick<CategoryDiscoverPayload, "featured" | "trending" | "popular">
): boolean {
  return (
    hasCatalogItems(data.featured) ||
    hasCatalogItems(data.trending) ||
    hasCatalogItems(data.popular)
  );
}

function isCategoryRailsCacheable(
  data: Pick<CategoryDiscoverPayload, "topRated" | "newEpisodes" | "genres">
): boolean {
  return (
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

export type CategoryDiscoverHeroPayload = Pick<
  CategoryDiscoverPayload,
  "featured" | "trending" | "popular"
>;

export type CategoryDiscoverRailsPayload = Pick<
  CategoryDiscoverPayload,
  "topRated" | "newEpisodes" | "genres"
>;

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
  nextCursor?: string | null;
  genreSlugs?: string[];
  ok?: boolean;
};

export type BrowseCatalogPageResults = {
  results: ContentItem[];
  totalPages?: number;
  total?: number;
  nextCursor?: string | null;
  ok?: boolean;
};

/** Client page size for browse /all grids — keep in sync with API default limit. */
export const BROWSE_CATALOG_PAGE_LIMIT = 48;

const EMPTY_CATEGORY: CategoryDiscoverPayload = {
  featured: [],
  trending: [],
  popular: [],
  topRated: [],
  newEpisodes: [],
  genres: [],
};

export { EMPTY_CATEGORY };

const EMPTY_GENRE_RAILS: GenrePageRails = {
  popular: [],
  top_rated: [],
  new: [],
};

const EMPTY_GENRE_PAGE: GenrePagePayload = {
  featured: [],
  total: 0,
  rails: EMPTY_GENRE_RAILS,
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
  const cached = readClientDayCache<ExploreBundle>(`${PREFIX}.explore.bundle.v4`);
  if (cached && isExploreBundleCacheable(cached)) return cached;
  return null;
}

/** Seed the day cache from SSR so client navigations skip a second /api/explore fetch. */
export function seedExploreBundleCache(bundle: ExploreBundle): void {
  if (!isExploreBundleCacheable(bundle)) return;
  writeClientDayCache(`${PREFIX}.explore.bundle.v4`, bundle);
}

export async function fetchExploreBundle(): Promise<ExploreBundle> {
  return withDayCache(
    `${PREFIX}.explore.bundle.v4`,
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

async function loadCategoryDiscoverPart(
  slug: string,
  preferences: UserPreferences | null,
  part: "hero" | "rails" | "topRated" | "newEpisodes" | "genres" | null
): Promise<CategoryDiscoverPayload> {
  try {
    const query = part ? `?part=${part}` : "";
    const res = hasUserPreferences(preferences)
      ? await fetch(`/api/category/${slug}/discover${query}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ preferences }),
        })
      : await fetch(`/api/category/${slug}/discover${query}`);
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

async function loadCategoryDiscover(
  slug: string,
  preferences: UserPreferences | null
): Promise<CategoryDiscoverPayload> {
  const [hero, topRated, newEpisodes, genres] = await Promise.all([
    loadCategoryDiscoverPart(slug, preferences, "hero"),
    loadCategoryDiscoverPart(slug, preferences, "topRated"),
    loadCategoryDiscoverPart(slug, preferences, "newEpisodes"),
    loadCategoryDiscoverPart(slug, preferences, "genres"),
  ]);
  return {
    ...EMPTY_CATEGORY,
    ...hero,
    ...topRated,
    ...newEpisodes,
    ...genres,
  };
}

export function categoryDiscoverHeroCacheKey(
  slug: string,
  preferences: UserPreferences | null = null
): string {
  return `${PREFIX}.category-discover-hero.v2:${slug}:${preferencesCacheKey(preferences)}`;
}

export function categoryDiscoverTopRatedCacheKey(
  slug: string,
  preferences: UserPreferences | null = null
): string {
  return `${PREFIX}.category-discover-top-rated.v1:${slug}:${preferencesCacheKey(preferences)}`;
}

export function categoryDiscoverNewEpisodesCacheKey(
  slug: string,
  preferences: UserPreferences | null = null
): string {
  return `${PREFIX}.category-discover-new-episodes.v1:${slug}:${preferencesCacheKey(preferences)}`;
}

export function categoryDiscoverGenresCacheKey(
  slug: string,
  preferences: UserPreferences | null = null
): string {
  return `${PREFIX}.category-discover-genres.v1:${slug}:${preferencesCacheKey(preferences)}`;
}

export function categoryDiscoverRailsCacheKey(
  slug: string,
  preferences: UserPreferences | null = null
): string {
  return `${PREFIX}.category-discover-rails.v3:${slug}:${preferencesCacheKey(preferences)}`;
}

export async function fetchCategoryDiscoverHero(
  slug: string,
  preferences: UserPreferences | null = null
): Promise<CategoryDiscoverHeroPayload> {
  return withDayCache(
    categoryDiscoverHeroCacheKey(slug, preferences),
    async () => {
      const hero = await loadCategoryDiscoverPart(slug, preferences, "hero");
      return {
        featured: hero.featured,
        trending: hero.trending,
        popular: hero.popular,
      };
    },
    { isCacheable: isCategoryHeroCacheable }
  );
}

export async function fetchCategoryDiscoverTopRated(
  slug: string,
  preferences: UserPreferences | null = null
): Promise<Pick<CategoryDiscoverPayload, "topRated">> {
  return withDayCache(
    categoryDiscoverTopRatedCacheKey(slug, preferences),
    async () => {
      const data = await loadCategoryDiscoverPart(slug, preferences, "topRated");
      return { topRated: data.topRated ?? [] };
    },
    { isCacheable: (data) => hasCatalogItems(data.topRated) }
  );
}

export async function fetchCategoryDiscoverNewEpisodes(
  slug: string,
  preferences: UserPreferences | null = null
): Promise<Pick<CategoryDiscoverPayload, "newEpisodes">> {
  return withDayCache(
    categoryDiscoverNewEpisodesCacheKey(slug, preferences),
    async () => {
      const data = await loadCategoryDiscoverPart(slug, preferences, "newEpisodes");
      return { newEpisodes: data.newEpisodes ?? [] };
    },
    { isCacheable: (data) => hasCatalogItems(data.newEpisodes) }
  );
}

export async function fetchCategoryDiscoverGenres(
  slug: string,
  preferences: UserPreferences | null = null
): Promise<Pick<CategoryDiscoverPayload, "genres">> {
  return withDayCache(
    categoryDiscoverGenresCacheKey(slug, preferences),
    async () => {
      const data = await loadCategoryDiscoverPart(slug, preferences, "genres");
      return { genres: data.genres ?? [] };
    },
    {
      isCacheable: (data) =>
        Array.isArray(data.genres) && data.genres.some((g) => (g.count ?? 0) > 0),
    }
  );
}

export async function fetchCategoryDiscoverRails(
  slug: string,
  preferences: UserPreferences | null = null
): Promise<CategoryDiscoverRailsPayload> {
  const [topRated, newEpisodes, genres] = await Promise.all([
    fetchCategoryDiscoverTopRated(slug, preferences),
    fetchCategoryDiscoverNewEpisodes(slug, preferences),
    fetchCategoryDiscoverGenres(slug, preferences),
  ]);
  return {
    topRated: topRated.topRated,
    newEpisodes: newEpisodes.newEpisodes,
    genres: genres.genres,
  };
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
      return loadCategoryDiscover(slug, preferences);
    },
    { isCacheable: isCategoryDiscoverCacheable }
  );
}

export function categoryDiscoverCacheKey(
  slug: string,
  preferences: UserPreferences | null = null
): string {
  return `${PREFIX}.category-discover.v20:${slug}:${preferencesCacheKey(preferences)}`;
}

export function categoryDiscoverPartNeeds(
  data: CategoryDiscoverPayload
): {
  hero: boolean;
  topRated: boolean;
  newEpisodes: boolean;
  genres: boolean;
} {
  return {
    hero: !isCategoryHeroCacheable(data),
    topRated: !hasCatalogItems(data.topRated),
    newEpisodes: !hasCatalogItems(data.newEpisodes),
    genres:
      !Array.isArray(data.genres) ||
      !data.genres.some((genre) => (genre.count ?? 0) > 0),
  };
}

/** Instant category hub paint from split day cache (hero + rails merged). */
export function peekCategoryDiscoverInitial(
  slug: string,
  preferences: UserPreferences | null = null
): CategoryDiscoverPayload {
  if (typeof window === "undefined") return EMPTY_CATEGORY;
  return peekCategoryDiscoverSplitCache(slug, preferences);
}

export function peekCategoryDiscoverSplitCache(
  slug: string,
  preferences: UserPreferences | null = null
): CategoryDiscoverPayload {
  const hero = readClientDayCache<CategoryDiscoverHeroPayload>(
    categoryDiscoverHeroCacheKey(slug, preferences)
  );
  const topRated = readClientDayCache<Pick<CategoryDiscoverPayload, "topRated">>(
    categoryDiscoverTopRatedCacheKey(slug, preferences)
  );
  const newEpisodes = readClientDayCache<
    Pick<CategoryDiscoverPayload, "newEpisodes">
  >(categoryDiscoverNewEpisodesCacheKey(slug, preferences));
  const genres = readClientDayCache<Pick<CategoryDiscoverPayload, "genres">>(
    categoryDiscoverGenresCacheKey(slug, preferences)
  );

  return {
    ...EMPTY_CATEGORY,
    ...(hero && isCategoryHeroCacheable(hero) ? hero : {}),
    ...(topRated && hasCatalogItems(topRated.topRated) ? topRated : {}),
    ...(newEpisodes && hasCatalogItems(newEpisodes.newEpisodes) ? newEpisodes : {}),
    ...(genres &&
    Array.isArray(genres.genres) &&
    genres.genres.some((g) => (g.count ?? 0) > 0)
      ? genres
      : {}),
  };
}

export function peekCategoryDiscoverCache(
  slug: string,
  preferences: UserPreferences | null = null
): CategoryDiscoverPayload | null {
  const cached = readClientDayCache<CategoryDiscoverPayload>(
    categoryDiscoverCacheKey(slug, preferences)
  );
  if (cached && isCategoryDiscoverCacheable(cached)) return cached;

  const split = peekCategoryDiscoverSplitCache(slug, preferences);
  if (isCategoryDiscoverCacheable(split)) return split;
  return null;
}

export async function fetchGenresIndex(): Promise<CatalogGenreRow[]> {
  return withDayCache(`${PREFIX}.genres-index.v1:name`, async () => {
    const bundle = await fetchExploreBundle();
    return [...bundle.genres].sort((a, b) => a.name.localeCompare(b.name));
  });
}

/** Instant genres index paint from day cache or explore bundle. */
export function peekGenresIndexCache(): CatalogGenreRow[] {
  if (typeof window === "undefined") return [];
  const cached = readClientDayCache<CatalogGenreRow[]>(`${PREFIX}.genres-index.v1:name`);
  if (Array.isArray(cached) && cached.length > 0) return cached;
  const bundle = peekExploreBundleCache();
  if (bundle?.genres?.length) {
    return [...bundle.genres].sort((a, b) => a.name.localeCompare(b.name));
  }
  return [];
}

function isGenrePageShellCacheable(
  data: Pick<GenrePagePayload, "featured" | "total" | "rails">
): boolean {
  return (
    hasCatalogItems(data.featured) ||
    hasCatalogItems(data.rails?.popular) ||
    (typeof data.total === "number" && data.total > 0)
  );
}

function isGenrePageTopRatedCacheable(
  data: Pick<GenrePagePayload, "rails">
): boolean {
  return hasCatalogItems(data.rails?.top_rated);
}

function isGenrePageNewCacheable(data: Pick<GenrePagePayload, "rails">): boolean {
  return hasCatalogItems(data.rails?.new);
}

export function genrePageShellCacheKey(
  slug: string,
  type: "all" | "movie" | "tv",
  preferences: UserPreferences | null = null
): string {
  return `${PREFIX}.genre-page-shell.v1:${slug}:${type}:${preferencesCacheKey(preferences)}`;
}

export function genrePageTopRatedCacheKey(
  slug: string,
  type: "all" | "movie" | "tv",
  preferences: UserPreferences | null = null
): string {
  return `${PREFIX}.genre-page-top-rated.v1:${slug}:${type}:${preferencesCacheKey(preferences)}`;
}

export function genrePageNewCacheKey(
  slug: string,
  type: "all" | "movie" | "tv",
  preferences: UserPreferences | null = null
): string {
  return `${PREFIX}.genre-page-new.v1:${slug}:${type}:${preferencesCacheKey(preferences)}`;
}

async function loadGenrePagePart(
  slug: string,
  type: "all" | "movie" | "tv",
  preferences: UserPreferences | null,
  part: "shell" | "top_rated" | "new"
): Promise<Partial<GenrePagePayload>> {
  try {
    const query = new URLSearchParams({ slug, limit: "24", part });
    if (type !== "all") query.set("type", type);

    const res = hasUserPreferences(preferences)
      ? await fetch("/api/genre/page", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, type, limit: 24, part, preferences }),
        })
      : await fetch(`/api/genre/page?${query.toString()}`);

    if (!res.ok) return {};
    const data = await res.json();
    if (part === "shell") {
      return {
        featured: data.featured ?? [],
        total: typeof data.total === "number" ? data.total : 0,
        rails: {
          popular: data.rails?.popular ?? [],
          top_rated: [],
          new: [],
        },
      };
    }
    if (part === "top_rated") {
      return {
        rails: {
          popular: [],
          top_rated: data.rails?.top_rated ?? [],
          new: [],
        },
      };
    }
    return {
      rails: {
        popular: [],
        top_rated: [],
        new: data.rails?.new ?? [],
      },
    };
  } catch {
    return {};
  }
}

export function genrePagePartNeeds(
  data: GenrePagePayload
): { shell: boolean; topRated: boolean; newRail: boolean } {
  return {
    shell: !isGenrePageShellCacheable(data),
    topRated: !isGenrePageTopRatedCacheable(data),
    newRail: !isGenrePageNewCacheable(data),
  };
}

export function peekGenrePageSplitCache(
  slug: string,
  type: "all" | "movie" | "tv",
  preferences: UserPreferences | null = null
): GenrePagePayload {
  const shell = readClientDayCache<
    Pick<GenrePagePayload, "featured" | "total" | "rails">
  >(genrePageShellCacheKey(slug, type, preferences));
  const topRated = readClientDayCache<Pick<GenrePagePayload, "rails">>(
    genrePageTopRatedCacheKey(slug, type, preferences)
  );
  const newRail = readClientDayCache<Pick<GenrePagePayload, "rails">>(
    genrePageNewCacheKey(slug, type, preferences)
  );
  const monolith = readClientDayCache<GenrePagePayload>(
    genrePageCacheKey(slug, type, preferences)
  );

  if (monolith && isGenrePageCacheable(monolith)) {
    return monolith;
  }

  const featured =
    shell && isGenrePageShellCacheable(shell) ? shell.featured : [];
  const total =
    shell && isGenrePageShellCacheable(shell) && typeof shell.total === "number"
      ? shell.total
      : 0;
  const popular =
    shell && isGenrePageShellCacheable(shell) ? shell.rails?.popular ?? [] : [];
  const topRatedItems =
    topRated && isGenrePageTopRatedCacheable(topRated)
      ? topRated.rails?.top_rated ?? []
      : [];
  const newItems =
    newRail && isGenrePageNewCacheable(newRail) ? newRail.rails?.new ?? [] : [];

  return {
    featured,
    total,
    rails: {
      popular,
      top_rated: topRatedItems,
      new: newItems,
    },
  };
}

/** Instant genre page paint from split day cache. */
export function peekGenrePageInitial(
  slug: string,
  type: "all" | "movie" | "tv",
  preferences: UserPreferences | null = null
): GenrePagePayload {
  if (typeof window === "undefined") return EMPTY_GENRE_PAGE;
  return peekGenrePageSplitCache(slug, type, preferences);
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
  const split = peekGenrePageSplitCache(slug, type, preferences);
  if (isGenrePageCacheable(split)) return split;
  return null;
}

export async function fetchGenrePageShell(
  slug: string,
  type: "all" | "movie" | "tv",
  preferences: UserPreferences | null = null
): Promise<Pick<GenrePagePayload, "featured" | "total" | "rails">> {
  return withDayCache(
    genrePageShellCacheKey(slug, type, preferences),
    async () => {
      const part = await loadGenrePagePart(slug, type, preferences, "shell");
      return {
        featured: part.featured ?? [],
        total: typeof part.total === "number" ? part.total : 0,
        rails: {
          popular: part.rails?.popular ?? [],
          top_rated: [],
          new: [],
        },
      };
    },
    { isCacheable: isGenrePageShellCacheable }
  );
}

export async function fetchGenrePageTopRated(
  slug: string,
  type: "all" | "movie" | "tv",
  preferences: UserPreferences | null = null
): Promise<Pick<GenrePagePayload, "rails">> {
  return withDayCache(
    genrePageTopRatedCacheKey(slug, type, preferences),
    async () => {
      const part = await loadGenrePagePart(slug, type, preferences, "top_rated");
      return {
        rails: {
          popular: [],
          top_rated: part.rails?.top_rated ?? [],
          new: [],
        },
      };
    },
    { isCacheable: isGenrePageTopRatedCacheable }
  );
}

export async function fetchGenrePageNew(
  slug: string,
  type: "all" | "movie" | "tv",
  preferences: UserPreferences | null = null
): Promise<Pick<GenrePagePayload, "rails">> {
  return withDayCache(
    genrePageNewCacheKey(slug, type, preferences),
    async () => {
      const part = await loadGenrePagePart(slug, type, preferences, "new");
      return {
        rails: {
          popular: [],
          top_rated: [],
          new: part.rails?.new ?? [],
        },
      };
    },
    { isCacheable: isGenrePageNewCacheable }
  );
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
      nextCursor:
        typeof listJson.nextCursor === "string" ? listJson.nextCursor : null,
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
  const cacheKey = `${PREFIX}.browse-page.v3:${namespace}:${queryString}`;
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
  opts: { page?: number; after?: string | null } = {}
): void {
  if (typeof window === "undefined") return;
  const query = new URLSearchParams(filterQueryString);
  if (opts.after) {
    query.delete("page");
    query.set("after", opts.after);
  } else if (opts.page != null && opts.page >= 2) {
    query.set("page", String(opts.page));
  } else {
    return;
  }
  void fetchBrowseCatalogPageResults(namespace, apiPath, query.toString());
}

export function browseCatalogCacheKey(
  namespace: string,
  queryString: string
): string {
  return `${PREFIX}.browse.v15:${namespace}:${queryString}`;
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
          nextCursor: listData.nextCursor ?? null,
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
