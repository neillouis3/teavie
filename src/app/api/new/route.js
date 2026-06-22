import clientPromise from "@/lib/mongo";
import { mapCatalogListDoc } from "@/lib/mapContentDocToItem";
import {
  mongoCatalogPopularitySortExpr,
  mongoMixedTvCatalogPopularityExpr,
} from "@/lib/catalogPopularity";
import { catalogMoviePolicyClause } from "@/lib/catalogQuery";

export async function GET(req) {
  try {
    const client = await clientPromise;
    const contentCollection = client.db("teavie").collection("content");

    const { searchParams } = new URL(req.url);

    const now = new Date();
    const daysBack = 30;
    const past = new Date(now);
    past.setDate(past.getDate() - daysBack);
    const toDateString = (d) => d.toISOString().split("T")[0];
    const startDate = toDateString(past);
    const endDate = toDateString(now);

    const type = (searchParams.get("type") || "").trim().toLowerCase();

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      48,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const skip = (page - 1) * limit;

    // New = released in the recent window; order by catalog popularity then recency
    /** @type {Record<string, unknown>} */
    let filter;
    if (type === "movie") {
      filter = {
        $and: [
          {
            type: "movie",
            release_date: {
              $gte: startDate,
              $lte: endDate,
            },
          },
          catalogMoviePolicyClause(),
        ],
      };
    } else if (type === "tv") {
      filter = {
        type: "tv",
        first_air_date: {
          $gte: startDate,
          $lte: endDate,
        },
      };
    } else {
      filter = {
        $or: [
          {
            $and: [
              {
                type: "movie",
                release_date: {
                  $gte: startDate,
                  $lte: endDate,
                },
              },
              catalogMoviePolicyClause(),
            ],
          },
          {
            type: "tv",
            first_air_date: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        ],
      };
    }

    const sortPopExpr =
      type === "movie"
        ? {
            $convert: { input: "$popularity", to: "double", onError: 0, onNull: 0 },
          }
        : type === "tv"
          ? mongoMixedTvCatalogPopularityExpr()
          : mongoCatalogPopularitySortExpr();

    const pipeline = [
      {
        $match: filter,
      },
      {
        $addFields: {
          sortDate: {
            $ifNull: ["$release_date", "$first_air_date"],
          },
          sortPop: sortPopExpr,
        },
      },
      {
        $sort: { sortPop: -1, sortDate: -1, _id: -1 },
      },
      {
        $facet: {
          pageItems: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: "n" }],
        },
      },
    ];

    const agg = await contentCollection.aggregate(pipeline).toArray();
    const facet = agg[0] ?? { pageItems: [], totalCount: [] };
    const results = facet.pageItems ?? [];
    const total = facet.totalCount?.[0]?.n ?? 0;

    return Response.json({
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      results: results.map(mapCatalogListDoc),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to fetch new content" }, { status: 500 });
  }
}
