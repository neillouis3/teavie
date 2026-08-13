import clientPromise from "@/lib/mongo";
import { catalogSort } from "@/lib/catalogQuery";
import {
  fetchCatalogBrowsePage,
  CATALOG_BROWSE_CACHE_HEADERS,
} from "@/lib/api/catalogBrowsePage";
import { getCachedCatalogBrowse } from "@/lib/api/catalogBrowseCache";
import { BROWSE_DEFAULT_SORT } from "@/lib/catalogSortOptions";

/**
 * @param {Request} req
 * @param {{
 *   namespace: string;
 *   buildFilter: (searchParams: URLSearchParams) => Record<string, unknown> | Promise<Record<string, unknown>>;
 *   mapRow: (doc: Record<string, unknown>) => unknown;
 *   popExpr?: object | null;
 *   browseOptions?: Record<string, unknown>;
 *   sortOptions?: Record<string, unknown>;
 * }} config
 */
export async function handleCatalogBrowseGet(req, config) {
  const client = await clientPromise;
  const collection = client.db("teavie").collection("content");
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    48,
    Math.max(1, parseInt(searchParams.get("limit") || "48", 10))
  );
  const after = searchParams.get("after");
  const useCursor = Boolean(after);
  const skip = useCursor ? 0 : (page - 1) * limit;

  const sortBy = searchParams.get("sort_by") || BROWSE_DEFAULT_SORT;
  const sort = catalogSort(sortBy, config.sortOptions ?? {});
  const filter = await config.buildFilter(searchParams);
  const includeTotal = page <= 1 && !useCursor;

  const cacheKey = `${config.namespace}:${searchParams.toString()}`;
  const { total, results, nextCursor } = await getCachedCatalogBrowse(cacheKey, () =>
    fetchCatalogBrowsePage(
      collection,
      filter,
      sortBy,
      sort,
      skip,
      limit,
      config.popExpr ?? null,
      {
        ...(config.browseOptions ?? {}),
        qualityPopular: sortBy === "popularity",
        includeTotal,
        after,
      }
    )
  );

  return Response.json(
    {
      page: useCursor ? undefined : page,
      limit,
      ...(includeTotal
        ? {
            total,
            totalPages: Math.max(1, Math.ceil((total ?? 0) / limit)),
          }
        : {}),
      nextCursor: nextCursor ?? null,
      results: results.map(config.mapRow),
    },
    { headers: CATALOG_BROWSE_CACHE_HEADERS }
  );
}
