import clientPromise from "@/lib/mongo";
import {
  buildCatalogFilter,
  catalogAnimeIdMongoExpr,
  catalogExcludeAdultAnimeMongoClause,
  catalogSort,
  catalogTodayIsoUtc,
  releasedAnimeFirstAirClause,
} from "@/lib/catalogQuery";
import {
  catalogDisplayVoteAverage,
  catalogPopularityScore,
  mongoAnimeCatalogPopularityExpr,
} from "@/lib/catalogPopularity";
import { mapCatalogListDoc } from "@/lib/mapContentDocToItem";
import {
  mergedSplitCourEpisodeCount,
  splitCourGroupForMal,
  catalogAnimeSplitCourHiddenClause,
} from "@/lib/animeSplitCour";
import {
  fetchCatalogBrowsePage,
  CATALOG_BROWSE_CACHE_HEADERS,
} from "@/lib/api/catalogBrowsePage";

function mapAnimeRow(doc) {
  const mapped = mapCatalogListDoc({
    ...doc,
    vote_average: catalogDisplayVoteAverage(doc),
    popularity: catalogPopularityScore(doc, { anime: true }),
  });
  const group = splitCourGroupForMal(doc.mal_id);
  if (group && group.primaryMalId === Number(doc.mal_id)) {
    mapped.number_of_episodes = mergedSplitCourEpisodeCount(group);
  }
  return mapped;
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

    const sortBy = searchParams.get("sort_by") || "popularity";
    const sort = catalogSort(sortBy, {
      titleAsc: { name: 1, _id: -1 },
      titleDesc: { name: -1, _id: -1 },
      dateDesc: { first_air_date: -1, _id: -1 },
      dateAsc: { first_air_date: 1, _id: -1 },
    });

    const base = buildCatalogFilter(searchParams, {
      type: "tv",
      dateField: "first_air_date",
      animeMultilingualTitleSearch: true,
    });

    const includeUnreleased = searchParams.get("include_unreleased") === "1";
    const todayIso = catalogTodayIsoUtc();
    const released = includeUnreleased ? [] : [releasedAnimeFirstAirClause(todayIso)];
    const filter = {
      $and: [
        base,
        catalogAnimeIdMongoExpr(),
        catalogAnimeSplitCourHiddenClause(),
        catalogExcludeAdultAnimeMongoClause(),
        ...released,
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
      mongoAnimeCatalogPopularityExpr(),
      { includeTotal, anime: true, qualityPopular: sortBy === "popularity" }
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
        results: results.map(mapAnimeRow),
      },
      { headers: CATALOG_BROWSE_CACHE_HEADERS }
    );
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to fetch anime" }, { status: 500 });
  }
}

