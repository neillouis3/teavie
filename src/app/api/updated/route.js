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

    // Fetch and sort by updatedAt (or createdAt if needed)
    const cursor = contentCollection
      .find({})
      .sort({ updatedAt: -1 }) // newest first
      .skip(skip)
      .limit(limit);

    const results = await cursor.toArray();
    const total = await contentCollection.countDocuments();

    return new Response(
      JSON.stringify({
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        results: results.map((doc) => ({
          id: doc.id.toString(),
          title: doc.title ?? doc.name,
          date: doc.updatedAt ?? doc.release_date ?? doc.first_air_date ?? null,
          popularity: doc.popularity ?? 0,
          genre_ids: doc.genre_ids ?? [],
          poster_path: doc.poster_path ?? null,
          backdrop_path: doc.backdrop_path ?? null,
          type: doc.type, // "movie" | "tv"
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
      JSON.stringify({ error: "Failed to fetch content" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
