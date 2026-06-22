/**
 * Unified genre catalog: movies + TV (or filtered by type).
 * Query: slug, type=all|movie|tv, sort=popular|top_rated|new, page, limit, q, year_min, year_max
 */

import clientPromise from "@/lib/mongo";
import {
  buildCatalogFilter,
  catalogImdbGenreMatchClause,
  catalogTodayIsoUtc,
  catalogTvBrowseNonAnimeClause,
  catalogTvBrowseReleasedClause,
  releasedCatalogClause,
} from "@/lib/catalogQuery";
import {
  catalogDisplayVoteAverage,
  catalogPopularityScore,
} from "@/lib/catalogPopularity";
import { imdbGenreLabelFromSlug, isValidImdbGenreSlug } from "@/lib/imdbGenres";
import { mapContentDocToItem } from "@/lib/mapContentDocToItem";

const DEFAULT_LIMIT = 28;

function mapSortParam(sort) {
  switch (String(sort ?? "").trim()) {
    case "top_rated":
      return "vote_average";
    case "new":
      return "release_year";
    case "popular":
    default:
      return "popularity";
  }
}

function mapDocRow(doc) {
  return mapContentDocToItem({
    ...doc,
    vote_average: catalogDisplayVoteAverage(doc),
    popularity: catalogPopularityScore(doc),
  });
}

function buildFilter(slug, type, searchParams, todayIso) {
  if (!catalogImdbGenreMatchClause(slug)) return null;

  /** @type {Record<string, unknown>[]} */
  const branches = [];

  if (type === "all" || type === "movie") {
    const movieCore = buildCatalogFilter(searchParams, {
      type: "movie",
      dateField: "release_date",
    });
    branches.push({
      $and: [movieCore, releasedCatalogClause("release_date", todayIso)],
    });
  }

  if (type === "all" || type === "tv") {
    const tvCore = buildCatalogFilter(searchParams, {
      type: "tv",
      dateField: "first_air_date",
      animeMultilingualTitleSearch: true,
    });
    branches.push({
      $and: [
        tvCore,
        catalogTvBrowseNonAnimeClause(),
        catalogTvBrowseReleasedClause("first_air_date", todayIso),
      ],
    });
  }

  if (branches.length === 0) return null;
  return branches.length === 1 ? branches[0] : { $or: branches };
}

function sortStage(sortBy) {
  switch (sortBy) {
    case "vote_average":
      return { vote_average: -1, _sortDate: -1, _id: -1 };
    case "release_year":
      return { _sortDate: -1, _id: -1 };
    case "popularity":
    default:
      return { _pop: -1, _sortDate: -1, _id: -1 };
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug")?.trim() ?? "";
    const type = searchParams.get("type")?.trim() || "all";
    const sortBy = mapSortParam(searchParams.get("sort"));

    if (!isValidImdbGenreSlug(slug)) {
      return Response.json({ error: "Invalid genre" }, { status: 400 });
    }

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      48,
      Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10))
    );
    const skip = (page - 1) * limit;
    const todayIso = catalogTodayIsoUtc();

    const filterParams = new URLSearchParams(searchParams.toString());
    filterParams.set("genre", slug);

    const filter = buildFilter(slug, type, filterParams, todayIso);
    if (!filter) {
      return Response.json({ error: "Invalid genre filter" }, { status: 400 });
    }

    const popDouble = {
      $convert: { input: "$popularity", to: "double", onError: 0, onNull: 0 },
    };
    const popExpr = {
      $cond: [
        { $regexMatch: { input: { $toString: "$id" }, regex: "^anime_" } },
        { $divide: [popDouble, 1000] },
        popDouble,
      ],
    };

    const pipeline = [
      { $match: filter },
      {
        $addFields: {
          _pop: popExpr,
          _sortDate: { $ifNull: ["$release_date", "$first_air_date"] },
          vote_average: {
            $convert: {
              input: "$vote_average",
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
      { $sort: sortStage(sortBy) },
      { $skip: skip },
      { $limit: limit },
      { $project: { _pop: 0, _sortDate: 0 } },
    ];

    const client = await clientPromise;
    const col = client.db("teavie").collection("content");

    const [total, docs] = await Promise.all([
      col.countDocuments(filter),
      col.aggregate(pipeline).toArray(),
    ]);

    return Response.json({
      slug,
      label: imdbGenreLabelFromSlug(slug),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      results: docs.map(mapDocRow),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Genre fetch failed" }, { status: 500 });
  }
}
