import {
  catalogAnimeIdMongoExpr,
  catalogKdramaClause,
  catalogTodayIsoUtc,
  catalogTvBrowseReleasedClause,
  releasedAnimeFirstAirClause,
} from "@/lib/catalogQuery";
import {
  catalogDisplayVoteAverage,
  catalogPopularityScore,
  mongoAnimeCatalogPopularityExpr,
  mongoMixedTvCatalogPopularityExpr,
} from "@/lib/catalogPopularity";
import {
  catalogDocReleaseDateString,
  runtimeSecondsFromDoc,
  tvEpisodeCountFromDoc,
  tvSeasonCountFromDoc,
} from "@/lib/mapContentDocToItem";
import { IMDB_GENRES, orderGenreRowsByPreference } from "@/lib/imdbGenres";
import { getCatalogCategory } from "@/lib/catalogCategories";
import { mergeWithPreferenceFilter } from "@/lib/preferenceMatch";
import { hasUserPreferences } from "@/types/user";

const TILE_POSTERS = 5;
const RAIL_LIMIT = 24;
const TRENDING_LIMIT = 16;
const FEATURED_SIZE = 2;
const FEATURED_POOL = 48;

const HAS_POSTER_OR_BACKDROP = {
  $or: [
    { backdrop_path: { $type: "string", $regex: /\S/ } },
    { poster_path: { $type: "string", $regex: /\S/ } },
  ],
};

const HAS_IMDB_ID = { imdb_id: { $type: "string", $regex: /^tt/i } };

function popularityExpr(anime = false) {
  const popDouble = {
    $convert: { input: "$popularity", to: "double", onError: 0, onNull: 0 },
  };
  if (anime) {
    return { $divide: [popDouble, 1000] };
  }
  return popDouble;
}

function mapTvRow(doc, { anime = false } = {}) {
  const release_date = catalogDocReleaseDateString(doc);
  return {
    id: doc.id.toString(),
    title: doc.title ?? doc.name,
    release_date,
    runtimeSeconds: runtimeSecondsFromDoc(doc),
    season_amount: tvSeasonCountFromDoc(doc),
    number_of_episodes: tvEpisodeCountFromDoc(doc),
    popularity: catalogPopularityScore(doc, { anime }),
    vote_average: catalogDisplayVoteAverage(doc),
    poster_path: doc.poster_path ?? null,
    backdrop_path: doc.backdrop_path ?? null,
    type: "tv",
  };
}

/** @param {"anime"|"kdrama"} kind */
function categoryReleasedFilter(kind) {
  const todayIso = catalogTodayIsoUtc();
  if (kind === "anime") {
    return {
      $and: [
        catalogAnimeIdMongoExpr(),
        releasedAnimeFirstAirClause(todayIso),
      ],
    };
  }
  return {
    $and: [
      catalogKdramaClause(),
      catalogTvBrowseReleasedClause("first_air_date", todayIso),
    ],
  };
}

async function pickFeatured(col, filter, { anime = false } = {}) {
  const popExpr = popularityExpr(anime);
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

async function fetchRail(col, baseFilter, { anime = false, sort = "popular", limit = RAIL_LIMIT, extraClause = null } = {}) {
  const filter = extraClause
    ? { $and: [baseFilter, extraClause] }
    : baseFilter;

  if (sort === "popular") {
    const popExpr = anime ? mongoAnimeCatalogPopularityExpr() : mongoMixedTvCatalogPopularityExpr();
    const rows = await col
      .aggregate([
        { $match: filter },
        { $addFields: { _catalogPop: popExpr } },
        { $sort: { _catalogPop: -1, _id: -1 } },
        { $limit: limit },
        { $project: { _catalogPop: 0 } },
      ])
      .toArray();
    return rows.map((doc) => mapTvRow(doc, { anime }));
  }

  if (sort === "top_rated") {
    const rows = await col
      .aggregate([
        { $match: filter },
        {
          $addFields: {
            _vote: {
              $convert: { input: "$vote_average", to: "double", onError: 0, onNull: 0 },
            },
          },
        },
        { $match: { _vote: { $gte: 1 } } },
        { $sort: { _vote: -1, _id: -1 } },
        { $limit: limit },
        { $project: { _vote: 0 } },
      ])
      .toArray();
    return rows.map((doc) => mapTvRow(doc, { anime }));
  }

  const rows = await col
    .find(filter)
    .sort({ first_air_date: -1, _id: -1 })
    .limit(limit)
    .toArray();
  return rows.map((doc) => mapTvRow(doc, { anime }));
}

function buildGenrePipeline(matchStage, labels, withPosters) {
  const group = {
    _id: "$imdb_genres",
    count: { $sum: 1 },
    score: { $sum: "$_pop" },
  };
  if (withPosters) {
    group.posters = {
      $topN: { n: TILE_POSTERS, sortBy: { _pop: -1 }, output: "$poster_path" },
    };
  }
  return [
    { $match: matchStage },
    {
      $addFields: {
        _pop: {
          $convert: { input: "$popularity", to: "double", onError: 0, onNull: 0 },
        },
      },
    },
    { $unwind: "$imdb_genres" },
    { $match: { imdb_genres: { $in: labels } } },
    { $group: group },
    { $sort: { score: -1, count: -1 } },
  ];
}

async function rankCategoryGenres(col, baseFilter) {
  const labels = IMDB_GENRES.map((g) => g.label);
  let rows;
  try {
    rows = await col
      .aggregate(buildGenrePipeline(baseFilter, labels, true))
      .toArray();
  } catch {
    rows = await col
      .aggregate(buildGenrePipeline(baseFilter, labels, false))
      .toArray();
  }

  const slugByLabel = new Map(IMDB_GENRES.map((g) => [g.label, g.slug]));

  return assignUniquePosters(
    rows
      .filter((r) => labels.includes(r._id) && r.count > 0)
      .map((r) => ({
        slug: slugByLabel.get(r._id) ?? String(r._id).toLowerCase().replace(/\s+/g, "-"),
        name: r._id,
        count: r.count,
        posters: (r.posters || [])
          .filter((p) => typeof p === "string" && p.trim().length > 0)
          .slice(0, TILE_POSTERS),
      }))
  );
}

/** Pick posters per genre without reusing paths from earlier tiles. */
function assignUniquePosters(rows) {
  const used = new Set();
  return rows.map((row) => {
    const picked = [];
    for (const path of row.posters ?? []) {
      if (used.has(path)) continue;
      picked.push(path);
      used.add(path);
      if (picked.length >= 3) break;
    }
    return { ...row, posters: picked };
  });
}

function dedupeFeatured(rail, featured) {
  if (!featured.length) return rail;
  const keys = new Set(featured.map((item) => `${item.type ?? "tv"}-${item.id}`));
  return rail.filter((item) => !keys.has(`${item.type ?? "tv"}-${item.id}`));
}

/**
 * @param {import("mongodb").Collection} col
 * @param {string} slug
 */
export async function fetchCategoryGenres(col, slug) {
  const category = getCatalogCategory(slug);
  if (!category) return [];

  const kind = category.slug === "anime" ? "anime" : "kdrama";
  const baseFilter = categoryReleasedFilter(kind);
  return rankCategoryGenres(col, baseFilter);
}

/**
 * @param {import("mongodb").Collection} col
 * @param {string} slug
 * @param {import('@/types/user').UserPreferences | null} [preferences]
 */
export async function fetchCategoryDiscover(col, slug, preferences = null) {
  const category = getCatalogCategory(slug);
  if (!category) return null;

  const kind = category.slug === "anime" ? "anime" : "kdrama";
  const anime = kind === "anime";
  let baseFilter = categoryReleasedFilter(kind);

  if (hasUserPreferences(preferences)) {
    baseFilter = mergeWithPreferenceFilter(baseFilter, preferences, {
      skipGenres: true,
      skipCategories: true,
    });
  }

  const [
    featuredDocs,
    trending,
    popular,
    topRated,
    newest,
    genres,
  ] = await Promise.all([
    pickFeatured(col, baseFilter, { anime }),
    fetchRail(col, baseFilter, { anime, sort: "popular", limit: TRENDING_LIMIT }),
    fetchRail(col, baseFilter, { anime, sort: "popular" }),
    fetchRail(col, baseFilter, { anime, sort: "top_rated" }),
    fetchRail(col, baseFilter, { anime, sort: "new" }),
    rankCategoryGenres(col, baseFilter),
  ]);

  const featured = featuredDocs.map((doc) => mapTvRow(doc, { anime }));

  return {
    featured,
    trending,
    popular: dedupeFeatured(popular, featured),
    topRated,
    new: newest,
    genres: hasUserPreferences(preferences)
      ? orderGenreRowsByPreference(genres, preferences.genres)
      : genres,
  };
}
