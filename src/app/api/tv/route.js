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

    const sortBy = searchParams.get("sort_by") || "title";
    let sort = {};

    switch (sortBy) {
      case "release_year":
        sort = { first_air_date: -1, _id: -1 };
        break;
      case "popularity":
        sort = { popularity: -1, _id: -1 };
        break;
      case "title_desc":
        sort = { name: -1, _id: -1 };
        break;
      case "title":
      default:
        sort = { name: 1, _id: -1 };
        break;
    }

    const total = await collection.countDocuments({ type: "tv" });

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
            id: doc.id.toString(),
            title: doc.title ?? doc.name,
            release_date,
            runtime: doc.runtime ?? null,
            season_amount: doc.season_amount ?? null,
            popularity: doc.popularity ?? 0,
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
      JSON.stringify({ error: "Failed to fetch tv shows" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

