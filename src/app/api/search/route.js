import clientPromise from "@/lib/mongo";

export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("teavie");
    const collection = db.collection("content");

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "24", 10), 48);
    const skip = (page - 1) * limit;

    if (!q) {
      return new Response(
        JSON.stringify({
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
          results: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const filter = {
      $or: [
        { title: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
      ],
    };

    const [total, results] = await Promise.all([
      collection.countDocuments(filter),
      collection
        .find(filter)
        .sort({ popularity: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
    ]);

    return new Response(
      JSON.stringify({
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        results: results.map((doc) => {
          const rawDate =
            doc.release_date ??
            doc.releaseDate ??
            doc.first_air_date ??
            doc.firstAirDate ??
            null;
          const release_date =
            rawDate == null
              ? null
              : typeof rawDate === "string"
                ? rawDate
                : rawDate.toISOString?.().split("T")[0] ?? null;
          return {
            id: typeof doc.id === "number" ? doc.id : parseInt(doc.id, 10) || doc.id,
            title: doc.title ?? doc.name,
            release_date,
            first_air_date: doc.first_air_date ?? null,
            runtimeSeconds: doc.runtimeSeconds ?? null,
            season_amount: doc.season_amount ?? doc.number_of_seasons ?? null,
            popularity: doc.popularity ?? 0,
            genre_ids: doc.genre_ids ?? [],
            poster_path: doc.poster_path ?? null,
            backdrop_path: doc.backdrop_path ?? null,
            type: doc.type ?? "movie",
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
      JSON.stringify({ error: "Search failed" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
