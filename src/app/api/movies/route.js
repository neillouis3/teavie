import clientPromise from "@/lib/mongo";
import {
  buildCatalogFilter,
  catalogSort,
  catalogTodayIsoUtc,
  releasedCatalogClause,
} from "@/lib/catalogQuery";
import { mapCatalogListDoc } from "@/lib/mapContentDocToItem";
import {
  fetchCatalogBrowsePage,
  CATALOG_BROWSE_CACHE_HEADERS,
} from "@/lib/api/catalogBrowsePage";

export async function GET(req) {
  try {
    const client = await clientPromise;
    const collection = client.db("teavie").collection("content");

    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      48,
      Math.max(1, parseInt(searchParams.get("limit") || "28", 10))
    );
    const skip = (page - 1) * limit;

    const sortBy = searchParams.get("sort_by") || "title";
    const sort = catalogSort(sortBy, {
      titleAsc: { title: 1, _id: -1 },
      titleDesc: { title: -1, _id: -1 },
      dateDesc: { release_date: -1, _id: -1 },
      dateAsc: { release_date: 1, _id: -1 },
    });

    const base = buildCatalogFilter(searchParams, {
      type: "movie",
      dateField: "release_date",
    });
    const includeUnreleased = searchParams.get("include_unreleased") === "1";
    const todayIso = catalogTodayIsoUtc();
    const filter = includeUnreleased
      ? base
      : { $and: [base, releasedCatalogClause("release_date", todayIso)] };

    const includeTotal = page <= 1;
    const { total, results } = await fetchCatalogBrowsePage(
      collection,
      filter,
      sortBy,
      sort,
      skip,
      limit,
      null,
      { includeTotal, indexedPopularity: sortBy === "popularity" }
    );

    return Response.json(
      {
        page,
        limit,
        ...(includeTotal
          ? {
              total,
              totalPages: Math.max(1, Math.ceil((total ?? 0) / limit)),
            }
          : {}),
        results: results.map(mapCatalogListDoc),
      },
      { headers: CATALOG_BROWSE_CACHE_HEADERS }
    );
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to fetch movies" }, { status: 500 });
  }
}
