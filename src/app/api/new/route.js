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

    // Date range: last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    // Query both movies & tv from same collection
    const cursor = contentCollection
      .find({
        $or: [
          {
            release_date: {
              $gte: thirtyDaysAgo.toISOString().split("T")[0],
              $lte: today.toISOString().split("T")[0],
            },
          },
          {
            first_air_date: {
              $gte: thirtyDaysAgo.toISOString().split("T")[0],
              $lte: today.toISOString().split("T")[0],
            },
          },
        ],
      })
      .sort({ release_date: -1, first_air_date: -1 })
      .skip(skip)
      .limit(limit);

    const results = await cursor.toArray();
    const total = await contentCollection.countDocuments({
      $or: [
        {
          release_date: {
            $gte: thirtyDaysAgo.toISOString().split("T")[0],
            $lte: today.toISOString().split("T")[0],
          },
        },
        {
          first_air_date: {
            $gte: thirtyDaysAgo.toISOString().split("T")[0],
            $lte: today.toISOString().split("T")[0],
          },
        },
      ],
    });

    return new Response(
      JSON.stringify({
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        results: results.map((doc) => ({
          id: doc.id.toString(),
          title: doc.title ?? doc.name,
          release_date: doc.release_date ?? doc.first_air_date,
          popularity: doc.popularity ?? 0,
          genre_ids: doc.genre_ids ?? [],
          poster_path: doc.poster_path ?? null,
          type: doc.type, // "movie" | "tv"
        })),
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
