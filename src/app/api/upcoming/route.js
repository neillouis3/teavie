import clientPromise from "@/lib/mongo";
import { mapCatalogListDoc } from "@/lib/mapContentDocToItem";

export async function GET(req) {
  try {
    const client = await clientPromise;
    const contentCollection = client.db("teavie").collection("content");

    const { searchParams } = new URL(req.url);
    const type = (searchParams.get("type") || "").trim().toLowerCase();
    const sampleSize = Math.min(
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

    // Aggregation: only items releasing between now and one month ahead
    const cursor = contentCollection.aggregate([
      {
        $addFields: {
          sortDate: {
            $ifNull: ["$release_date", "$first_air_date"],
          },
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
      { $sort: { sortDate: 1 } }, // soonest releases first
      { $limit: 120 },
      { $sample: { size: sampleSize } },
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
    return Response.json({ error: "Failed to fetch random content" }, { status: 500 });
  }
}
