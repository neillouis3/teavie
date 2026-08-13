import clientPromise from "@/lib/mongo";
import {
  buildKdramaCatalogFilter,
  catalogSort,
  catalogTodayIsoUtc,
  catalogTvBrowseReleasedClause,
} from "@/lib/catalogQuery";
import {
  catalogDisplayVoteAverage,
  catalogPopularityScore,
} from "@/lib/catalogPopularity";
import { mapCatalogListDoc } from "@/lib/mapContentDocToItem";
import {
  fetchCatalogBrowsePage,
  CATALOG_BROWSE_CACHE_HEADERS,
} from "@/lib/api/catalogBrowsePage";

function mapKdramaRow(doc) {
  return mapCatalogListDoc({
    ...doc,
    vote_average: catalogDisplayVoteAverage(doc),
    popularity: catalogPopularityScore(doc),
  });
}

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
      titleAsc: { name: 1, _id: -1 },
      titleDesc: { name: -1, _id: -1 },
      dateDesc: { first_air_date: -1, _id: -1 },
      dateAsc: { first_air_date: 1, _id: -1 },
    });

    const includeUnreleased = searchParams.get("include_unreleased") === "1";
    const todayIso = catalogTodayIsoUtc();
    const core = buildKdramaCatalogFilter(searchParams);
    const filter = includeUnreleased
      ? core
      : {
          $and: [
            core,
            catalogTvBrowseReleasedClause("first_air_date", todayIso),
          ],
        };

    const includeTotal = page <= 1;
    const { total, results } = await fetchCatalogBrowsePage(
      collection,
      filter,
      sortBy,
      sort,
      skip,
      limit,
      null,
      {
        includeTotal,
        indexedPopularity: sortBy === "popularity",
      }
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
        results: results.map(mapKdramaRow),
      },
      { headers: CATALOG_BROWSE_CACHE_HEADERS }
    );
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to fetch K-Drama" }, { status: 500 });
  }
}
