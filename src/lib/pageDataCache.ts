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
      const [newRes, updatedRes, upcomingRes] = await Promise.all([
        fetch("/api/new"),
        fetch("/api/updated"),
        fetch("/api/upcoming?type=movie"),
      ]);

      const [newData, updatedData, upcomingData] = await Promise.all([
        newRes.ok ? newRes.json() : { results: [] },
        updatedRes.ok ? updatedRes.json() : { results: [] },
        upcomingRes.ok ? upcomingRes.json() : { results: [] },
      ]);

      return {
        newContent: newData.results ?? [],
        updatedContent: updatedData.results ?? [],
        upcomingContent: upcomingData.results ?? [],
      };
    } catch {
      return { newContent: [], updatedContent: [], upcomingContent: [] };
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
    try {
      const res = await fetch("/api/genres/popular?sort=name");
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json.genres) ? json.genres : [];
    } catch {
      return [];
    }
  });
}

export async function fetchGenrePagePayload(
  slug: string,
  type: "all" | "movie" | "tv"
): Promise<GenrePagePayload> {
  return withDayCache(`${PREFIX}.genre-page.v1:${slug}:${type}`, async () => {
    const buildQs = (sort: string) => {
      const qs = new URLSearchParams();
      qs.set("slug", slug);
      qs.set("sort", sort);
      qs.set("limit", "24");
      qs.set("page", "1");
      if (type !== "all") qs.set("type", type);
      return qs.toString();
    };

    try {
      const [popularJson, topRatedJson, newJson] = await Promise.all(
        (["popular", "top_rated", "new"] as const).map((sort) =>
          fetch(`/api/genre?${buildQs(sort)}`).then((res) =>
            res.ok ? res.json() : { results: [], featured: [], total: 0 }
          )
        )
      );

      const featured = Array.isArray(popularJson.featured) ? popularJson.featured : [];
      const featuredKeys = new Set(
        featured.map((item: ContentItem) => `${item.type ?? "movie"}-${item.id}`)
      );

      const dedupe = (rail: ContentItem[]) =>
        featured.length === 0
          ? rail
          : rail.filter(
              (item) => !featuredKeys.has(`${item.type ?? "movie"}-${item.id}`)
            );

      return {
        featured,
        total: typeof popularJson.total === "number" ? popularJson.total : 0,
        rails: {
          popular: dedupe(popularJson.results ?? []),
          top_rated: topRatedJson.results ?? [],
          new: newJson.results ?? [],
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
  const cacheKey = `${PREFIX}.browse.v1:${namespace}:${queryString}`;
  return withDayCache(cacheKey, async () => {
    const fetches: Promise<Response>[] = [fetch(`${apiPath}?${queryString}`)];
    if (genreApiPath) {
      fetches.push(fetch(genreApiPath));
    }

    try {
      const [listRes, genreRes] = await Promise.all(fetches);
      const listJson = listRes.ok
        ? await listRes.json()
        : { results: [], totalPages: 1, total: 0 };

      let genreSlugs: string[] | undefined;
      if (genreRes) {
        const genreJson = genreRes.ok ? await genreRes.json() : { genres: [] };
        genreSlugs = (genreJson.genres ?? [])
          .filter((g: { count?: number }) => (g.count ?? 0) > 0)
          .map((g: { slug: string }) => g.slug);
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
