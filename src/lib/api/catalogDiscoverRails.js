/**
 * Fast explore discover rails from Mongo (no live TMDB paging).
 */

import clientPromise from "@/lib/mongo";
import { mapContentDocToItem } from "@/lib/mapContentDocToItem";
import {
  catalogMoviePolicyClause,
  catalogTodayIsoUtc,
  releasedCatalogClause,
} from "@/lib/catalogQuery";
import {
  CATALOG_POPULAR_MIN_VOTE_AVERAGE,
  mongoCatalogDisplayVoteExpr,
  mongoCatalogPopularitySortExpr,
  mongoMixedTvCatalogPopularityExpr,
} from "@/lib/catalogPopularity";
import { dedupeContentItems } from "@/lib/dedupeContentItems";

const LIMIT = 50;
const TRENDING_DAYS = 120;

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
    ],
  };
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

  const docs = await col.aggregate(pipeline).toArray();
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

  const docs = await col.aggregate(pipeline).toArray();
  return capItems(docs.map((doc) => ({ ...mapContentDocToItem(doc), type: "tv" })));
}

export async function loadCatalogDiscoverRails() {
  const client = await clientPromise;
  const col = client.db("teavie").collection("content");

  const [
    trendingMoviesRaw,
    trendingTvRaw,
    popularMoviesRaw,
    popularTvRaw,
  ] = await Promise.all([
    queryMovieRail(col, { trending: true }),
    queryTvRail(col, { trending: true }),
    queryMovieRail(col, { qualityPopular: true }),
    queryTvRail(col, { qualityPopular: true }),
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
    trendingMoviesRaw.length >= 8
      ? trendingMoviesRaw
      : popularMovies;
  const trendingTv =
    trendingTvRaw.length >= 8
      ? trendingTvRaw
      : popularTv;

  return {
    trendingMovies,
    trendingTv,
    popularMovies,
    popularTv,
  };
}
