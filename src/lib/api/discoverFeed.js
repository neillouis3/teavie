/**
 * Batched discover feed: new + updated + upcoming in one server round-trip.
 */

import clientPromise from "@/lib/mongo";
import { mapCatalogListDoc } from "@/lib/mapContentDocToItem";
import {
  mongoCatalogPopularitySortExpr,
  mongoMixedTvCatalogPopularityExpr,
} from "@/lib/catalogPopularity";
import {
  catalogMoviePolicyClause,
  catalogGeneralTvRailPolicyClause,
} from "@/lib/catalogQuery";

const RAIL_FEED_LIMIT = 50;
const NEW_CONTENT_LIMIT = 20;

async function loadNewContent() {
  const client = await clientPromise;
  const contentCollection = client.db("teavie").collection("content");

  const now = new Date();
  const past = new Date(now);
  past.setDate(past.getDate() - 30);
  const toDateString = (d) => d.toISOString().split("T")[0];
  const startDate = toDateString(past);
  const endDate = toDateString(now);
  const limit = NEW_CONTENT_LIMIT;

  const filter = {
    $or: [
      {
        $and: [
          {
            type: "movie",
            release_date: { $gte: startDate, $lte: endDate },
          },
          catalogMoviePolicyClause(),
        ],
      },
      {
        type: "tv",
        first_air_date: { $gte: startDate, $lte: endDate },
      },
    ],
  };

  const pipeline = [
    { $match: filter },
    {
      $addFields: {
        sortDate: { $ifNull: ["$release_date", "$first_air_date"] },
        sortPop: mongoCatalogPopularitySortExpr(),
      },
    },
    { $sort: { sortPop: -1, sortDate: -1, _id: -1 } },
    { $limit: limit },
  ];

  const results = await contentCollection.aggregate(pipeline).toArray();
  return results.map(mapCatalogListDoc);
}

async function loadUpdatedContent() {
  const client = await clientPromise;
  const contentCollection = client.db("teavie").collection("content");
  const limit = NEW_CONTENT_LIMIT;

  const filter = {
    $or: [
      {
        $and: [{ type: "movie" }, catalogMoviePolicyClause()],
      },
      {
        $and: [
          { type: "tv" },
          { id: { $not: { $regex: "^anime_" } } },
          { is_anime: { $ne: true } },
          catalogGeneralTvRailPolicyClause(),
        ],
      },
    ],
  };

  const results = await contentCollection
    .find(filter)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();

  return results.map((doc) => {
    const base = mapCatalogListDoc(doc);
    return {
      ...base,
      date: doc.updatedAt ?? doc.release_date ?? doc.first_air_date ?? null,
      first_air_date: base.release_date,
    };
  });
}

async function loadUpcomingContent() {
  const client = await clientPromise;
  const contentCollection = client.db("teavie").collection("content");
  const limit = RAIL_FEED_LIMIT;

  const now = new Date();
  const oneMonthAhead = new Date();
  oneMonthAhead.setMonth(oneMonthAhead.getMonth() + 1);
  const toDateString = (d) => d.toISOString().split("T")[0];
  const startDate = toDateString(now);
  const endDate = toDateString(oneMonthAhead);

  const results = await contentCollection
    .aggregate([
      {
        $addFields: {
          sortDate: { $ifNull: ["$release_date", "$first_air_date"] },
          sortPop: {
            $cond: [
              { $eq: ["$type", "movie"] },
              {
                $convert: { input: "$popularity", to: "double", onError: 0, onNull: 0 },
              },
              mongoMixedTvCatalogPopularityExpr(),
            ],
          },
        },
      },
      {
        $match: {
          type: "movie",
          sortDate: { $gte: startDate, $lte: endDate },
        },
      },
      { $match: catalogMoviePolicyClause() },
      { $sort: { sortPop: -1, sortDate: 1 } },
      { $limit: limit },
    ])
    .toArray();

  return results.map((doc) => ({
    ...mapCatalogListDoc(doc),
    updatedAt: doc.updatedAt ?? null,
  }));
}

export async function loadDiscoverFeed() {
  const [newContent, updatedContent, upcomingContent] = await Promise.all([
    loadNewContent(),
    loadUpdatedContent(),
    loadUpcomingContent(),
  ]);
  return { newContent, updatedContent, upcomingContent };
}
