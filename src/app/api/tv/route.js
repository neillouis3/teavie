import clientPromise from "@/lib/mongo";
import {
  buildCatalogFilter,
  catalogSort,
  catalogTodayIsoUtc,
  releasedCatalogClause,
} from "@/lib/catalogQuery";
import { catalogPopularityScore } from "@/lib/catalogPopularity";

export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("teavie");
    const collection = db.collection("content");

    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      48,
      Math.max(1, parseInt(searchParams.get("limit") || "28", 10))
    );
    const skip = (page - 1) * limit;

    const sortBy = searchParams.get("sort_by") || "title";
    const sort = catalogSort(sortBy, {
      titleAsc: { name: 1, _id: -1 },
      titleDesc: { name: -1, _id: -1 },
      dateDesc: { first_air_date: -1, _id: -1 },
      dateAsc: { first_air_date: 1, _id: -1 },
    });

    const base = buildCatalogFilter(searchParams, {
      type: "tv",
      dateField: "first_air_date",
    });
    const notAnime = {
      $nor: [{ is_anime: true }, { tags: "anime" }],
    };
    const includeUnreleased = searchParams.get("include_unreleased") === "1";
    const todayIso = catalogTodayIsoUtc();
    const released = includeUnreleased
      ? []
      : [releasedCatalogClause("first_air_date", todayIso)];
    const filter = { $and: [base, notAnime, ...released] };

    const total = await collection.countDocuments(filter);

    const results = await collection
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    return new Response(
      JSON.stringify({
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
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
            runtimeSeconds: doc.runtimeSeconds ?? null,
            season_amount: doc.season_amount ?? doc.number_of_seasons ?? null,
            popularity: catalogPopularityScore(doc),
            vote_average: doc.vote_average ?? null,
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
    return new Response(JSON.stringify({ error: "Failed to fetch tv shows" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
