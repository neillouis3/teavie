import clientPromise from "@/lib/mongo";

export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("teavie");
    const collection = db.collection("content");

    const { searchParams } = new URL(req.url);

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "15", 10);
    const skip = (page - 1) * limit;

    const sortBy = searchParams.get("sort_by") || "title"; // ✅ default sort
    let sort = {};

    // 🏷️ choose sort dynamically
    if (sortBy === "release_year") {
      sort = { first_air_date: -1, _id: -1 }; // newest first
    } else if (sortBy === "title") {
      sort = { name: 1, _id: -1 }; // A → Z
    } else {
      sort = { updatedAt: -1, _id: -1 }; // fallback
    }

    // ✅ Count only movies
    const total = await collection.countDocuments({ type: "tv" });

    // ✅ Fetch only movies with chosen sort
    const results = await collection
      .find({ type: "tv" })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    return new Response(
      JSON.stringify({
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        results: results.map((doc) => ({
          id: doc.id.toString(),
          title: doc.title ?? doc.name,
          release_date: doc.release_date ?? doc.first_air_date ?? null,
          runtime: doc.runtime ?? null,
          season_amount: doc.season_amount ?? null,
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
    return new Response(JSON.stringify({ error: "Failed to fetch movies" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
