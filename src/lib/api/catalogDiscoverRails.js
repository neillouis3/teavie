/**
 * Fast explore discover rails from Mongo (no live TMDB paging).
 * Hero + popular prefer TMDB order from `npm run seed:popular` when ranks are fresh.
 */

import clientPromise from "@/lib/mongo";
import { mapContentDocToItem } from "@/lib/mapContentDocToItem";
import {
  catalogMoviePolicyClause,
  catalogTodayIsoUtc,
  releasedCatalogClause,
  catalogGeneralTvRailPolicyClause,
} from "@/lib/catalogQuery";
import {
  CATALOG_POPULAR_MIN_VOTE_AVERAGE,
  mongoCatalogDisplayVoteExpr,
  mongoCatalogPopularitySortExpr,
  mongoMixedTvCatalogPopularityExpr,
} from "@/lib/catalogPopularity";
import { dedupeContentItems } from "@/lib/dedupeContentItems";
import {
  exploreSeedFreshClause,
  mongoExploreRankSortKeyExpr,
} from "@/lib/exploreSeedRank";

const LIMIT = 50;
const TRENDING_DAYS = 120;
const MIN_SEEDED = 8;
const AGG_OPTS = { allowDiskUse: true };

const HAS_ART = {
  $or: [
    { poster_path: { $type: "string", $regex: /\S/ } },
    { backdrop_path: { $type: "string", $regex: /\S/ } },
  ],
};

function capItems(items) {
  return dedupeContentItems(items).slice(0, LIMIT);
}

function trendingCutoffIso() {
  const d = new Date();
  d.setDate(d.getDate() - TRENDING_DAYS);
  return d.toISOString().slice(0, 10);
}

function movieBaseMatch(todayIso) {
  return {
    $and: [
      { type: "movie" },
      catalogMoviePolicyClause(),
      releasedCatalogClause("release_date", todayIso),
      HAS_ART,
    ],
  };
}

function generalTvBaseMatch(todayIso) {
  return {
    $and: [
      { type: "tv" },
      { id: { $not: { $regex: "^anime_" } } },
      { is_anime: { $ne: true } },
      { is_kdrama: { $ne: true } },
      { catalog_categories: { $ne: "kdrama" } },
      releasedCatalogClause("first_air_date", todayIso),
      HAS_ART,
      catalogGeneralTvRailPolicyClause(),
    ],
  };
}

async function querySeededRail(col, { baseMatch, rankField, type }) {
  const pipeline = [
    {
      $match: {
        $and: [
          baseMatch,
          exploreSeedFreshClause(),
          { [rankField]: { $type: "number", $gt: 0 } },
        ],
      },
    },
    {
      $addFields: {
        _rank: mongoExploreRankSortKeyExpr(rankField),
        _vote: mongoCatalogDisplayVoteExpr(),
      },
    },
    { $sort: { _rank: 1, _id: -1 } },
    { $limit: LIMIT + 24 },
  ];

  const docs = await col.aggregate(pipeline, AGG_OPTS).toArray();
  return capItems(
    docs.map((doc) => ({ ...mapContentDocToItem(doc), type }))
  );
}

async function queryMovieRail(col, { trending = false, qualityPopular = false } = {}) {
  const todayIso = catalogTodayIsoUtc();
  const matchParts = [movieBaseMatch(todayIso)];

  if (trending) {
    const cutoff = trendingCutoffIso();
    matchParts.push({ release_date: { $gte: cutoff, $lte: todayIso } });
  }

  const pipeline = [
    { $match: { $and: matchParts } },
    {
      $addFields: {
        _pop: mongoCatalogPopularitySortExpr(),
        _vote: mongoCatalogDisplayVoteExpr(),
      },
    },
  ];

  if (qualityPopular) {
    pipeline.push({ $match: { _vote: { $gte: CATALOG_POPULAR_MIN_VOTE_AVERAGE } } });
  }

  pipeline.push({ $sort: { _pop: -1, _id: -1 } }, { $limit: LIMIT + 24 });

  const docs = await col.aggregate(pipeline, AGG_OPTS).toArray();
  return capItems(
    docs.map((doc) => ({ ...mapContentDocToItem(doc), type: "movie" }))
  );
}

async function queryTvRail(col, { trending = false, qualityPopular = false } = {}) {
  const todayIso = catalogTodayIsoUtc();
  const matchParts = [generalTvBaseMatch(todayIso)];

  if (trending) {
    const cutoff = trendingCutoffIso();
    matchParts.push({ first_air_date: { $gte: cutoff, $lte: todayIso } });
  }

  const pipeline = [
    { $match: { $and: matchParts } },
    {
      $addFields: {
        _pop: mongoMixedTvCatalogPopularityExpr(),
        _vote: mongoCatalogDisplayVoteExpr(),
      },
    },
  ];

  if (qualityPopular) {
    pipeline.push({ $match: { _vote: { $gte: CATALOG_POPULAR_MIN_VOTE_AVERAGE } } });
  }

  pipeline.push({ $sort: { _pop: -1, _id: -1 } }, { $limit: LIMIT + 24 });

  const docs = await col.aggregate(pipeline, AGG_OPTS).toArray();
  return capItems(docs.map((doc) => ({ ...mapContentDocToItem(doc), type: "tv" })));
}

export async function loadCatalogDiscoverRails() {
  const client = await clientPromise;
  const col = client.db("teavie").collection("content");
  const todayIso = catalogTodayIsoUtc();

  const [
    seededTrendingMovies,
    seededTrendingTv,
    seededPopularMovies,
    seededPopularTv,
  ] = await Promise.all([
    querySeededRail(col, {
      baseMatch: movieBaseMatch(todayIso),
      rankField: "explore_trending_rank",
      type: "movie",
    }),
    querySeededRail(col, {
      baseMatch: generalTvBaseMatch(todayIso),
      rankField: "explore_trending_rank",
      type: "tv",
    }),
    querySeededRail(col, {
      baseMatch: movieBaseMatch(todayIso),
      rankField: "explore_popular_rank",
      type: "movie",
    }),
    querySeededRail(col, {
      baseMatch: generalTvBaseMatch(todayIso),
      rankField: "explore_popular_rank",
      type: "tv",
    }),
  ]);

  const [
    trendingMoviesRaw,
    trendingTvRaw,
    popularMoviesRaw,
    popularTvRaw,
  ] = await Promise.all([
    seededTrendingMovies.length >= MIN_SEEDED
      ? seededTrendingMovies
      : queryMovieRail(col, { trending: true }),
    seededTrendingTv.length >= MIN_SEEDED
      ? seededTrendingTv
      : queryTvRail(col, { trending: true }),
    seededPopularMovies.length >= MIN_SEEDED
      ? seededPopularMovies
      : queryMovieRail(col, { qualityPopular: true }),
    seededPopularTv.length >= MIN_SEEDED
      ? seededPopularTv
      : queryTvRail(col, { qualityPopular: true }),
  ]);

  let popularMovies = popularMoviesRaw;
  let popularTv = popularTvRaw;
  if (popularMovies.length === 0) {
    popularMovies = await queryMovieRail(col, { qualityPopular: false });
  }
  if (popularTv.length === 0) {
    popularTv = await queryTvRail(col, { qualityPopular: false });
  }

  const trendingMovies =
    trendingMoviesRaw.length >= MIN_SEEDED
      ? trendingMoviesRaw
      : popularMovies;
  const trendingTv =
    trendingTvRaw.length >= MIN_SEEDED
      ? trendingTvRaw
      : popularTv;

  return {
    trendingMovies,
    trendingTv,
    popularMovies,
    popularTv,
  };
}
