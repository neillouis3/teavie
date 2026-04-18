import clientPromise from "@/lib/mongo";
import { mapCatalogListDoc } from "@/lib/mapContentDocToItem";

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

    // New = most recently released in the recent window (by release_date / first_air_date)
    /** @type {Record<string, unknown>} */
    let filter;
    if (type === "movie") {
      filter = {
        type: "movie",
        release_date: {
          $gte: startDate,
          $lte: endDate,
        },
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
            release_date: {
              $gte: startDate,
              $lte: endDate,
            },
          },
          {
            first_air_date: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        ],
      };
    }

    const cursor = contentCollection
      .find(filter)
      .sort({ release_date: -1, first_air_date: -1, _id: -1 })
      .skip(skip)
      .limit(limit);

    const [results, total] = await Promise.all([
      cursor.toArray(),
      contentCollection.countDocuments(filter),
    ]);

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
