import clientPromise from "@/lib/mongo";
import { catalogPopularityScore } from "@/lib/catalogPopularity";
import { tvEpisodeCountFromDoc } from "@/lib/mapContentDocToItem";

export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("teavie");

    const contentCollection = db.collection("content");

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

    return new Response(
      JSON.stringify({
        count: results.length,
        results: results.map((doc) => {
          const rawDate = doc.release_date ?? doc.releaseDate ?? doc.first_air_date ?? doc.firstAirDate ?? null;
          const release_date = rawDate == null ? null : typeof rawDate === "string" ? rawDate : rawDate.toISOString?.().split("T")[0] ?? null;
          return {
          id: doc.id.toString(),
          title: doc.title ?? doc.name,
          release_date,
          updatedAt: doc.updatedAt ?? null,
          runtimeSeconds: doc.runtimeSeconds ?? null,
          season_amount: doc.season_amount ?? doc.number_of_seasons ?? null,
          number_of_episodes: tvEpisodeCountFromDoc(doc),
          popularity: catalogPopularityScore(doc),
          genre_ids: doc.genre_ids ?? [],
          poster_path: doc.poster_path ?? null,
          backdrop_path: doc.backdrop_path ?? null,
          type: doc.type,
          };
        }),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Failed to fetch random content" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
