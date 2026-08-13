/**
 * Single-pass Mongo browse page: count + page rows in one aggregation.
 */

import {
  mongoCatalogDisplayVoteExpr,
  mongoCatalogAudienceVoteCountExpr,
  mongoTopRatedQualityMatch,
} from "@/lib/catalogPopularity.js";

/**
 * @param {import("mongodb").Collection} collection
 * @param {object} filter
 * @param {string} sortBy
 * @param {object} sort
 * @param {number} skip
 * @param {number} limit
 * @param {object | null} popExpr Mongo expression for popularity sort
 * @param {{ includeTotal?: boolean; anime?: boolean }} [options]
 */
export async function fetchCatalogBrowsePage(
  collection,
  filter,
  sortBy,
  sort,
  skip,
  limit,
  popExpr = null,
  { includeTotal = true, anime = false } = {}
) {
  if (sortBy === "rating") {
    const voteExpr = mongoCatalogDisplayVoteExpr({ anime });
    const baseStages = [
      { $match: filter },
      {
        $addFields: {
          _catalogVote: voteExpr,
          _voteWeight: mongoCatalogAudienceVoteCountExpr(),
        },
      },
      { $match: mongoTopRatedQualityMatch({ anime }) },
      {
        $sort: anime
          ? { _catalogVote: -1, _id: -1 }
          : { _catalogVote: -1, _voteWeight: -1, _id: -1 },
      },
    ];

    if (!includeTotal) {
      const results = await collection
        .aggregate([
          ...baseStages,
          { $skip: skip },
          { $limit: limit },
          { $project: { _catalogVote: 0, _voteWeight: 0 } },
        ])
        .toArray();
      return { total: undefined, results };
    }

    const [facet] = await collection
      .aggregate([
        ...baseStages,
        {
          $facet: {
            metadata: [{ $count: "total" }],
            results: [
              { $skip: skip },
              { $limit: limit },
              { $project: { _catalogVote: 0, _voteWeight: 0 } },
            ],
          },
        },
      ])
      .toArray();

    return {
      total: facet?.metadata?.[0]?.total ?? 0,
      results: facet?.results ?? [],
    };
  }

  if (sortBy === "popularity") {
    const pop = popExpr ?? {
      $convert: { input: "$popularity", to: "double", onError: 0, onNull: 0 },
    };
    const baseStages = [
      { $match: filter },
      { $addFields: { _catalogPop: pop } },
      { $sort: { _catalogPop: -1, _id: -1 } },
    ];

    if (!includeTotal) {
      const results = await collection
        .aggregate([
          ...baseStages,
          { $skip: skip },
          { $limit: limit },
          { $project: { _catalogPop: 0 } },
        ])
        .toArray();
      return { total: undefined, results };
    }

    const [facet] = await collection
      .aggregate([
        ...baseStages,
        {
          $facet: {
            metadata: [{ $count: "total" }],
            results: [
              { $skip: skip },
              { $limit: limit },
              { $project: { _catalogPop: 0 } },
            ],
          },
        },
      ])
      .toArray();

    return {
      total: facet?.metadata?.[0]?.total ?? 0,
      results: facet?.results ?? [],
    };
  }

  if (!includeTotal) {
    const results = await collection
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();
    return { total: undefined, results };
  }

  const [facet] = await collection
    .aggregate([
      { $match: filter },
      { $sort: sort },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          results: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ])
    .toArray();

  return {
    total: facet?.metadata?.[0]?.total ?? 0,
    results: facet?.results ?? [],
  };
}

export const CATALOG_BROWSE_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
};
