import type { ContentItem } from "@/types/content";
import type { CatalogGenreRow } from "@/components/genre/genreTileShared";
import { readClientDayCache, writeClientDayCache } from "@/lib/clientDayCache";

const PREFIX = "teavie.cache";

async function withDayCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = readClientDayCache<T>(key);
  if (cached) return cached;
  const data = await fetcher();
  writeClientDayCache(key, data);
  return data;
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
  return withDayCache(`${PREFIX}.discover-feed.v1`, async () => {
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
  });
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
  return withDayCache(`${PREFIX}.explore.bundle.v1`, async () => {
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
  });
}

export async function fetchCategoryDiscover(
  slug: string
): Promise<CategoryDiscoverPayload> {
  return withDayCache(`${PREFIX}.category-discover.v1:${slug}`, async () => {
    try {
      const res = await fetch(`/api/category/${slug}/discover`);
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
  });
}

export async function fetchGenresIndex(): Promise<CatalogGenreRow[]> {
  return withDayCache(`${PREFIX}.genres-index.v1:name`, async () => {
    const bundle = await fetchExploreBundle();
    return [...bundle.genres].sort((a, b) => a.name.localeCompare(b.name));
  });
}

export async function fetchGenrePagePayload(
  slug: string,
  type: "all" | "movie" | "tv"
): Promise<GenrePagePayload> {
  return withDayCache(`${PREFIX}.genre-page.v1:${slug}:${type}`, async () => {
    try {
      const qs = new URLSearchParams({ slug, limit: "24" });
      if (type !== "all") qs.set("type", type);
      const res = await fetch(`/api/genre/page?${qs.toString()}`);
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
  });
}

export async function fetchBrowseCatalogPayload(
  namespace: string,
  apiPath: string,
  queryString: string,
  genreApiPath?: string
): Promise<BrowseCatalogPayload> {
  const cacheKey = `${PREFIX}.browse.v2:${namespace}:${queryString}`;
  return withDayCache(cacheKey, async () => {
    try {
      const listRes = await fetch(`${apiPath}?${queryString}`);
      const listJson = listRes.ok
        ? await listRes.json()
        : { results: [], totalPages: 1, total: 0 };

      let genreSlugs: string[] | undefined;
      if (genreApiPath) {
        try {
          const genreRes = await fetch(genreApiPath);
          const genreJson = genreRes.ok ? await genreRes.json() : { genres: [] };
          genreSlugs = (genreJson.genres ?? [])
            .filter((g: { count?: number }) => (g.count ?? 0) > 0)
            .map((g: { slug: string }) => g.slug);
        } catch {
          genreSlugs = undefined;
        }
      }

      return {
        results: listJson.results ?? [],
        totalPages: listJson.totalPages ?? 1,
        total: typeof listJson.total === "number" ? listJson.total : 0,
        genreSlugs,
      };
    } catch {
      return { results: [], totalPages: 1, total: 0, genreSlugs: undefined };
    }
  });
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
  return withDayCache(`${PREFIX}.search-results.v2:${queryString}`, async () => {
    const res = await fetch(`/api/search?${queryString}`);
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
  });
}
