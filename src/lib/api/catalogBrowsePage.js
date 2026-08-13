/**
 * Mongo browse page: count + page rows.
 * Indexed sorts (title, dates, TMDB popularity) use find + countDocuments.
 * Computed sorts (anime popularity, top rated) use aggregation with allowDiskUse.
 */

import {
  mongoCatalogDisplayVoteExpr,
  mongoCatalogAudienceVoteCountExpr,
  mongoPopularBrowseQualityMatch,
  CATALOG_BROWSE_HAS_ART,
  mongoTopRatedQualityMatch,
} from "@/lib/catalogPopularity.js";

/** Atlas caps in-memory sort at 32MB; free/shared tiers may ignore allowDiskUse. */
const AGG_OPTS = { allowDiskUse: true };

async function fetchIndexedBrowsePage(
  collection,
  filter,
  sort,
  skip,
  limit,
  includeTotal
) {
  const resultsPromise = collection
    .find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .toArray();

  if (!includeTotal) {
    return { total: undefined, results: await resultsPromise };
  }

  const [total, results] = await Promise.all([
    collection.countDocuments(filter),
    resultsPromise,
  ]);
  return { total, results };
}

/**
 * @param {import("mongodb").Collection} collection
 * @param {object} filter
 * @param {string} sortBy
 * @param {object} sort
 * @param {number} skip
 * @param {number} limit
 * @param {object | null} popExpr Mongo expression for computed popularity sort
 * @param {{ includeTotal?: boolean; anime?: boolean; indexedPopularity?: boolean; qualityPopular?: boolean }} [options]
 */
export async function fetchCatalogBrowsePage(
  collection,
  filter,
  sortBy,
  sort,
  skip,
  limit,
  popExpr = null,
  { includeTotal = true, anime = false, indexedPopularity = false, qualityPopular = false } = {}
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
        .aggregate(
          [
            ...baseStages,
            { $skip: skip },
            { $limit: limit },
            { $project: { _catalogVote: 0, _voteWeight: 0 } },
          ],
          AGG_OPTS
        )
        .toArray();
      return { total: undefined, results };
    }

    const [facet] = await collection
      .aggregate(
        [
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
        ],
        AGG_OPTS
      )
      .toArray();

    return {
      total: facet?.metadata?.[0]?.total ?? 0,
      results: facet?.results ?? [],
    };
  }

  if (sortBy === "popularity" && indexedPopularity && !qualityPopular) {
    return fetchIndexedBrowsePage(
      collection,
      filter,
      { popularity: -1, _id: -1 },
      skip,
      limit,
      includeTotal
    );
  }

  if (sortBy === "popularity") {
    const pop = popExpr ?? {
      $convert: { input: "$popularity", to: "double", onError: 0, onNull: 0 },
    };
    const voteExpr = mongoCatalogDisplayVoteExpr({ anime });
    const matchFilter = qualityPopular
      ? { $and: [filter, CATALOG_BROWSE_HAS_ART] }
      : filter;
    const baseStages = [
      { $match: matchFilter },
      {
        $addFields: {
          _catalogPop: pop,
          _catalogVote: voteExpr,
        },
      },
    ];

    if (qualityPopular) {
      baseStages.push({ $match: mongoPopularBrowseQualityMatch({ anime }) });
    }

    baseStages.push({ $sort: { _catalogPop: -1, _id: -1 } });

    if (!includeTotal) {
      const results = await collection
        .aggregate(
          [
            ...baseStages,
            { $skip: skip },
            { $limit: limit },
            { $project: { _catalogPop: 0, _catalogVote: 0 } },
          ],
          AGG_OPTS
        )
        .toArray();
      return { total: undefined, results };
    }

    const [facet] = await collection
      .aggregate(
        [
          ...baseStages,
          {
            $facet: {
              metadata: [{ $count: "total" }],
              results: [
                { $skip: skip },
                { $limit: limit },
                { $project: { _catalogPop: 0, _catalogVote: 0 } },
              ],
            },
          },
        ],
        AGG_OPTS
      )
      .toArray();

    return {
      total: facet?.metadata?.[0]?.total ?? 0,
      results: facet?.results ?? [],
    };
  }

  return fetchIndexedBrowsePage(
    collection,
    filter,
    sort,
    skip,
    limit,
    includeTotal
  );
}

export const CATALOG_BROWSE_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
};
