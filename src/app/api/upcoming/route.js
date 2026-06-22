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
    const type = (searchParams.get("type") || "").trim().toLowerCase();
    const limit = Math.min(
      40,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );

    // Define date window: from today through one month ahead
    const now = new Date();
    const oneMonthAhead = new Date();
    oneMonthAhead.setMonth(oneMonthAhead.getMonth() + 1);
    const toDateString = (d) => d.toISOString().split("T")[0];
    const startDate = toDateString(now);
    const endDate = toDateString(oneMonthAhead);

    /** @type {Record<string, unknown>} */
    const typeMatch =
      type === "movie" || type === "tv" ? { type } : {};

    const sortPopExpr =
      type === "movie"
        ? {
            $convert: { input: "$popularity", to: "double", onError: 0, onNull: 0 },
          }
        : type === "tv"
          ? mongoMixedTvCatalogPopularityExpr()
          : mongoCatalogPopularitySortExpr();

    // Popular titles first, then soonest release (TMDB-style popularity on movies/TV)
    const cursor = contentCollection.aggregate([
      {
        $addFields: {
          sortDate: {
            $ifNull: ["$release_date", "$first_air_date"],
          },
          sortPop: sortPopExpr,
        },
      },
      {
        $match: {
          ...typeMatch,
          sortDate: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      { $match: catalogMoviePolicyClause() },
      { $sort: { sortPop: -1, sortDate: 1 } },
      { $limit: limit },
    ]);

    const results = await cursor.toArray();

    return Response.json({
      count: results.length,
      results: results.map((doc) => ({
        ...mapCatalogListDoc(doc),
        updatedAt: doc.updatedAt ?? null,
      })),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to fetch upcoming content" }, { status: 500 });
  }
}
