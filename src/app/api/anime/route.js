import clientPromise from "@/lib/mongo";
import {
  buildCatalogFilter,
  catalogAnimeIdMongoExpr,
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

function mapAnimeRow(doc) {
  return mapCatalogListDoc({
    ...doc,
    vote_average: catalogDisplayVoteAverage(doc),
    popularity: catalogPopularityScore(doc, { anime: true }),
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

    const base = buildCatalogFilter(searchParams, {
      type: "tv",
      dateField: "first_air_date",
      animeMultilingualTitleSearch: true,
    });

    const includeUnreleased = searchParams.get("include_unreleased") === "1";
    const todayIso = catalogTodayIsoUtc();
    const released = includeUnreleased ? [] : [releasedAnimeFirstAirClause(todayIso)];
    const filter = { $and: [base, catalogAnimeIdMongoExpr(), ...released] };

    const popPipeline = [
      { $match: filter },
      { $addFields: { _catalogPop: mongoAnimeCatalogPopularityExpr() } },
      { $sort: { _catalogPop: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $project: { _catalogPop: 0 } },
    ];

    const [total, results] = await Promise.all([
      collection.countDocuments(filter),
      sortBy === "popularity"
        ? collection.aggregate(popPipeline).toArray()
        : collection.find(filter).sort(sort).skip(skip).limit(limit).toArray(),
    ]);

    return Response.json({
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      results: results.map(mapAnimeRow),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to fetch anime" }, { status: 500 });
  }
}

