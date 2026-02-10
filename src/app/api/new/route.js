import clientPromise from "@/lib/mongo";

export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("teavie");

    const contentCollection = db.collection("content");

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    // New = most recently released (by release_date / first_air_date), any time
    const cursor = contentCollection
      .find({
        $or: [
          { release_date: { $exists: true, $ne: null, $ne: "" } },
          { first_air_date: { $exists: true, $ne: null, $ne: "" } },
        ],
      })
      .sort({ release_date: -1, first_air_date: -1, _id: -1 })
      .skip(skip)
      .limit(limit);

    const results = await cursor.toArray();
    const total = await contentCollection.countDocuments({
      $or: [
        { release_date: { $exists: true, $ne: null, $ne: "" } },
        { first_air_date: { $exists: true, $ne: null, $ne: "" } },
      ],
    });

    return new Response(
      JSON.stringify({
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        results: results.map((doc) => {
          const rawDate = doc.release_date ?? doc.releaseDate ?? doc.first_air_date ?? doc.firstAirDate ?? null;
          const release_date = rawDate == null ? null : typeof rawDate === "string" ? rawDate : rawDate.toISOString?.().split("T")[0] ?? null;
          return {
          id: doc.id.toString(),
          title: doc.title ?? doc.name,
          release_date,
          runtimeSeconds: doc.runtimeSeconds ?? null,
          season_amount: doc.season_amount ?? null,
          popularity: doc.popularity ?? 0,
          genre_ids: doc.genre_ids ?? [],
          poster_path: doc.poster_path ?? null,
          backdrop_path: doc.backdrop_path ?? null,
          type: doc.type, // "movie" | "tv"
          };
        }),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Failed to fetch new content" }), {
      status: 500,
    });
  }
}
