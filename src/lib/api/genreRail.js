/**
 * Genre catalog query (shared by /api/genre and /api/genre/page).
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
const FEATURED_SIZE = 2;
const FEATURED_POOL = 48;

function popularityExpr() {
  const popDouble = {
    $convert: { input: "$popularity", to: "double", onError: 0, onNull: 0 },
  };
  return {
    $cond: [
      { $regexMatch: { input: { $toString: "$id" }, regex: "^anime_" } },
      { $divide: [popDouble, 1000] },
      popDouble,
    ],
  };
}

const HAS_POSTER_OR_BACKDROP = {
  $or: [
    { backdrop_path: { $type: "string", $regex: /\S/ } },
    { poster_path: { $type: "string", $regex: /\S/ } },
  ],
};

const HAS_IMDB_ID = { imdb_id: { $type: "string", $regex: /^tt/i } };

async function pickFeatured(col, filter) {
  const popExpr = popularityExpr();
  const baseStages = [
    { $match: filter },
    {
      $addFields: {
        _pop: popExpr,
        _vote: {
          $convert: { input: "$vote_average", to: "double", onError: 0, onNull: 0 },
        },
      },
    },
  ];

  async function sample(extraMatch, poolSize = FEATURED_POOL) {
    return col
      .aggregate([
        ...baseStages,
        { $match: extraMatch },
        { $sort: { _pop: -1, _id: -1 } },
        { $limit: poolSize },
        { $sample: { size: FEATURED_SIZE } },
        { $project: { _pop: 0, _vote: 0 } },
      ])
      .toArray();
  }

  const tiers = [
    { $and: [HAS_POSTER_OR_BACKDROP, HAS_IMDB_ID, { _vote: { $gte: 6 } }] },
    { $and: [HAS_POSTER_OR_BACKDROP, HAS_IMDB_ID] },
    HAS_POSTER_OR_BACKDROP,
    {},
  ];

  for (const tier of tiers) {
    const docs = await sample(tier);
    if (docs.length >= FEATURED_SIZE) return docs.slice(0, FEATURED_SIZE);
    if (docs.length > 0) return docs;
  }

  return [];
}

export function mapGenreSortParam(sort) {
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

/**
 * @param {{ slug: string; type?: string; sort?: string; page?: number; limit?: number; searchParams?: URLSearchParams }} opts
 */
export async function queryGenreRail(opts) {
  const slug = opts.slug?.trim() ?? "";
  const type = opts.type?.trim() || "all";
  const sortBy = mapGenreSortParam(opts.sort);
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(
    48,
    Math.max(1, opts.limit ?? DEFAULT_LIMIT)
  );
  const skip = (page - 1) * limit;
  const todayIso = catalogTodayIsoUtc();

  if (!isValidImdbGenreSlug(slug)) {
    return { error: "Invalid genre", status: 400 };
  }

  const filterParams = new URLSearchParams(opts.searchParams?.toString() ?? "");
  filterParams.set("genre", slug);

  const filter = buildFilter(slug, type, filterParams, todayIso);
  if (!filter) {
    return { error: "Invalid genre filter", status: 400 };
  }

  const popExpr = popularityExpr();
  const client = await clientPromise;
  const col = client.db("teavie").collection("content");

  const includeFeatured = page === 1 && sortBy === "popularity";
  let featuredDocs = [];
  let listFilter = filter;

  if (includeFeatured) {
    featuredDocs = await pickFeatured(col, filter);
    const featuredIds = featuredDocs.map((d) => d._id).filter(Boolean);
    if (featuredIds.length > 0) {
      listFilter = { $and: [filter, { _id: { $nin: featuredIds } }] };
    }
  }

  const pipeline = [
    { $match: listFilter },
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

  const [total, docs] = await Promise.all([
    col.countDocuments(filter),
    col.aggregate(pipeline).toArray(),
  ]);

  return {
    slug,
    label: imdbGenreLabelFromSlug(slug),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    featured: featuredDocs.map(mapDocRow),
    results: docs.map(mapDocRow),
  };
}

function dedupeFeatured(rail, featured) {
  if (!featured?.length) return rail;
  const keys = new Set(
    featured.map((item) => `${item.type ?? "movie"}-${item.id}`)
  );
  return rail.filter(
    (item) => !keys.has(`${item.type ?? "movie"}-${item.id}`)
  );
}

export async function loadGenrePage(slug, type = "all", limit = 24) {
  const sorts = ["popular", "top_rated", "new"];
  const rows = await Promise.all(
    sorts.map((sort) =>
      queryGenreRail({ slug, type, sort, page: 1, limit, searchParams: new URLSearchParams() })
    )
  );

  const popular = rows[0];
  if (popular.error) return popular;

  const featured = popular.featured ?? [];
  return {
    featured,
    total: popular.total ?? 0,
    rails: {
      popular: dedupeFeatured(popular.results ?? [], featured),
      top_rated: rows[1]?.results ?? [],
      new: rows[2]?.results ?? [],
    },
  };
}
