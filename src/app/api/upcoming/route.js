import clientPromise from "@/lib/mongo";

export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("teavie");

    const contentCollection = db.collection("content");

    // Step 1: aggregation to sort by release_date/first_air_date
    const cursor = contentCollection.aggregate([
      {
        $addFields: {
          sortDate: {
            $ifNull: ["$release_date", "$first_air_date"],
          },
        },
      },
      { $sort: { sortDate: -1 } }, // newest release first
      { $limit: 100 },             // only take top 100
      { $sample: { size: 20 } },   // randomly pick 20 from those
    ]);

    const results = await cursor.toArray();

    return new Response(
      JSON.stringify({
        count: results.length,
        results: results.map((doc) => ({
          id: doc.id.toString(),
          title: doc.title ?? doc.name,
          release_date: doc.release_date ?? doc.first_air_date ?? null,
          updatedAt: doc.updatedAt ?? null,
          runtime: doc.runtime ?? (doc.episode_run_time?.[0] ?? null),
          popularity: doc.popularity ?? 0,
          genre_ids: doc.genre_ids ?? [],
          poster_path: doc.poster_path ?? null,
          backdrop_path: doc.backdrop_path ?? null,
          type: doc.type,
        })),
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
