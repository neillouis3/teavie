import clientPromise from "@/lib/mongo";

export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("teavie");

    const contentCollection = db.collection("content");

    const { searchParams } = new URL(req.url);

    // Only take titles released recently: from N days ago up to today
    const now = new Date();
    const daysBack = 30; // adjust this window as needed
    const past = new Date(now);
    past.setDate(past.getDate() - daysBack);
    const toDateString = (d) => d.toISOString().split("T")[0];
    const startDate = toDateString(past);
    const endDate = toDateString(now);

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    // New = most recently released in the recent window (by release_date / first_air_date)
    const filter = {
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

    const cursor = contentCollection
      .find(filter)
      .sort({ release_date: -1, first_air_date: -1, _id: -1 })
      .skip(skip)
      .limit(limit);

    const results = await cursor.toArray();
    const total = await contentCollection.countDocuments(filter);

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
