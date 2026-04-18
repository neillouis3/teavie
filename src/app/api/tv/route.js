import clientPromise from "@/lib/mongo";
import {
  buildCatalogFilter,
  catalogSort,
  catalogTodayIsoUtc,
  catalogTmdbTvGenreMatchClause,
  catalogTvBrowseAudienceClause,
  catalogTvBrowseReleasedClause,
} from "@/lib/catalogQuery";
import {
  catalogDisplayVoteAverage,
  catalogPopularityScore,
  mongoMixedTvCatalogPopularityExpr,
} from "@/lib/catalogPopularity";
import { catalogDocReleaseDateString } from "@/lib/mapContentDocToItem";

function mapTvRow(doc) {
  const release_date = catalogDocReleaseDateString(doc);
  const ep =
    typeof doc.number_of_episodes === "number" && doc.number_of_episodes > 0
      ? doc.number_of_episodes
      : null;
  return {
    id: doc.id.toString(),
    title: doc.title ?? doc.name,
    release_date,
    runtimeSeconds: doc.runtimeSeconds ?? null,
    season_amount: doc.season_amount ?? doc.number_of_seasons ?? null,
    number_of_episodes: ep,
    popularity: catalogPopularityScore(doc),
    vote_average: catalogDisplayVoteAverage(doc),
    genre_ids: doc.genre_ids ?? [],
    poster_path: doc.poster_path ?? null,
    backdrop_path: doc.backdrop_path ?? null,
    type: doc.type,
  };
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

    const genreStr = searchParams.get("genre")?.trim();
    const genreNum =
      genreStr && /^\d+$/.test(genreStr) ? parseInt(genreStr, 10) : null;
    if (genreNum != null) {
      delete core.genre_ids;
    }

    const includeUnreleased = searchParams.get("include_unreleased") === "1";
    const todayIso = catalogTodayIsoUtc();

    /** @type {Record<string, unknown>[]} */
    const clauses = [
      core,
      catalogTvBrowseAudienceClause(),
      ...(genreNum != null ? [catalogTmdbTvGenreMatchClause(genreNum)] : []),
      ...(includeUnreleased ? [] : [catalogTvBrowseReleasedClause("first_air_date", todayIso)]),
    ];
    const filter = { $and: clauses };

    const popPipeline = [
      { $match: filter },
      { $addFields: { _catalogPop: mongoMixedTvCatalogPopularityExpr() } },
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
      results: results.map(mapTvRow),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to fetch tv shows" }, { status: 500 });
  }
}
