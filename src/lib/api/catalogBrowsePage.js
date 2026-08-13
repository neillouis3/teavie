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
  mongoTopRatedVoteExpr,
  mongoTopRatedSortExpr,
} from "@/lib/catalogPopularity.js";
import {
  browseCursorMatch,
  encodeBrowseCursor,
  parseBrowseCursor,
} from "@/lib/api/catalogBrowseCursor.js";

export { parseBrowseCursor };

/** @param {Record<string, unknown>} doc */
function stripBrowseComputedFields(doc) {
  const {
    _topRatedVote,
    _topRatedSort,
    _voteWeight,
    _catalogPop,
    _catalogVote,
    ...rest
  } = doc;
  return rest;
}

/** @param {Record<string, unknown>[]} results @param {string} sortBy @param {number} limit @param {{ anime?: boolean }} opts */
function packBrowsePage(results, sortBy, limit, opts = {}) {
  const nextCursor =
    results.length >= limit
      ? encodeBrowseCursor(results[results.length - 1], sortBy, opts)
      : null;
  return {
    results: results.map(stripBrowseComputedFields),
    nextCursor,
  };
}

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
    return { total: undefined, results: await resultsPromise, nextCursor: null };
  }

  const [total, results] = await Promise.all([
    collection.countDocuments(filter),
    resultsPromise,
  ]);
  return { total, results, nextCursor: null };
}

/**
 * @param {import("mongodb").Collection} collection
 * @param {object} filter
 * @param {string} sortBy
 * @param {object} sort
 * @param {number} skip
 * @param {number} limit
 * @param {object | null} popExpr Mongo expression for computed popularity sort
 * @param {{ includeTotal?: boolean; anime?: boolean; indexedPopularity?: boolean; qualityPopular?: boolean; after?: string | null }} [options]
 */
export async function fetchCatalogBrowsePage(
  collection,
  filter,
  sortBy,
  sort,
  skip,
  limit,
  popExpr = null,
  { includeTotal = true, anime = false, indexedPopularity = false, qualityPopular = false, after = null } = {}
) {
  const cursor = parseBrowseCursor(after, sortBy);
  const cursorMatch = cursor ? browseCursorMatch(cursor, sortBy, { anime }) : null;
  const useCursor = Boolean(cursorMatch);

  if (sortBy === "rating") {
    const voteExpr = mongoTopRatedVoteExpr({ anime });
    const baseStages = [
      { $match: filter },
      {
        $addFields: {
          _topRatedVote: voteExpr,
          _topRatedSort: mongoTopRatedSortExpr(voteExpr),
          _voteWeight: mongoCatalogAudienceVoteCountExpr(),
        },
      },
      { $match: mongoTopRatedQualityMatch({ anime }) },
    ];
    if (useCursor) {
      baseStages.push({ $match: cursorMatch });
    }
    baseStages.push({
      $sort: anime
        ? { _topRatedVote: -1, _id: -1 }
        : { _topRatedSort: -1, _voteWeight: -1, _id: -1 },
    });

    if (!includeTotal || useCursor) {
      const results = await collection
        .aggregate(
          [
            ...baseStages,
            ...(useCursor ? [] : [{ $skip: skip }]),
            { $limit: limit },
          ],
          AGG_OPTS
        )
        .toArray();
      const packed = packBrowsePage(results, sortBy, limit, { anime });
      return { total: undefined, ...packed };
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
              ],
            },
          },
        ],
        AGG_OPTS
      )
      .toArray();

    const results = facet?.results ?? [];
    const packed = packBrowsePage(results, sortBy, limit, { anime });
    return {
      total: facet?.metadata?.[0]?.total ?? 0,
      ...packed,
    };
  }

  if (sortBy === "popularity" && indexedPopularity && !qualityPopular) {
    return fetchIndexedBrowsePage(
      collection,
      filter,
      { popularity: -1, _id: -1 },
      skip,
      limit,
      includeTotal && !useCursor
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
    if (useCursor) {
      baseStages.push({ $match: cursorMatch });
    }

    baseStages.push({ $sort: { _catalogPop: -1, _id: -1 } });

    if (!includeTotal || useCursor) {
      const results = await collection
        .aggregate(
          [
            ...baseStages,
            ...(useCursor ? [] : [{ $skip: skip }]),
            { $limit: limit },
          ],
          AGG_OPTS
        )
        .toArray();
      const packed = packBrowsePage(results, sortBy, limit, { anime });
      return { total: undefined, ...packed };
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
              ],
            },
          },
        ],
        AGG_OPTS
      )
      .toArray();

    const results = facet?.results ?? [];
    const packed = packBrowsePage(results, sortBy, limit, { anime });
    return {
      total: facet?.metadata?.[0]?.total ?? 0,
      ...packed,
    };
  }

  return fetchIndexedBrowsePage(
    collection,
    filter,
    sort,
    skip,
    limit,
    includeTotal && !useCursor
  );
}

export const CATALOG_BROWSE_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
};
