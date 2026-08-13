import clientPromise from "@/lib/mongo";
import {
  buildCatalogFilter,
  catalogSort,
  catalogTodayIsoUtc,
  catalogTvBrowseNonAnimeClause,
  catalogTvBrowseReleasedClause,
  catalogExcludeBlockedTmdbTvMongoClause,
} from "@/lib/catalogQuery";
import {
  catalogDisplayVoteAverage,
  catalogPopularityScore,
  mongoMixedTvCatalogPopularityExpr,
} from "@/lib/catalogPopularity";
import { mapCatalogListDoc } from "@/lib/mapContentDocToItem";
import {
  fetchCatalogBrowsePage,
  CATALOG_BROWSE_CACHE_HEADERS,
} from "@/lib/api/catalogBrowsePage";

function mapTvRow(doc) {
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

    const core = buildCatalogFilter(searchParams, {
      type: "tv",
      dateField: "first_air_date",
      animeMultilingualTitleSearch: true,
    });

    const includeUnreleased = searchParams.get("include_unreleased") === "1";
    const todayIso = catalogTodayIsoUtc();

    /** @type {Record<string, unknown>[]} */
    const clauses = [core, catalogTvBrowseNonAnimeClause(), catalogExcludeBlockedTmdbTvMongoClause()];
    if (!includeUnreleased) {
      clauses.push(catalogTvBrowseReleasedClause("first_air_date", todayIso));
    }
    const filter = { $and: clauses };

    const includeTotal = page <= 1;
    const { total, results } = await fetchCatalogBrowsePage(
      collection,
      filter,
      sortBy,
      sort,
      skip,
      limit,
      mongoMixedTvCatalogPopularityExpr(),
      {
        includeTotal,
        qualityPopular: sortBy === "popularity",
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
        results: results.map(mapTvRow),
      },
      { headers: CATALOG_BROWSE_CACHE_HEADERS }
    );
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to fetch tv shows" }, { status: 500 });
  }
}
