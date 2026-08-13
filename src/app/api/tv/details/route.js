import clientPromise from "@/lib/mongo";
import { tmdbFetchJson } from "@/lib/tmdbAuth";
import {
  assertTvTmdbIdAllowed,
  isBlockedTvTmdbId,
  tmdbTvShowToPolicyProbe,
} from "@/lib/animeContentPolicy";
import { SHOW_UNAVAILABLE_MESSAGES } from "@/lib/tvJpAnimePrune";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id")?.trim();
    if (!id || !/^\d+$/.test(id)) {
      return Response.json({ error: "Provide a valid TMDB TV id" }, { status: 400 });
    }

    const numeric = Number(id);
    if (isBlockedTvTmdbId(numeric)) {
      return Response.json(
        {
          error: "content_policy",
          message: SHOW_UNAVAILABLE_MESSAGES.content_policy,
        },
        { status: 404 }
      );
    }

    const lite = searchParams.get("lite") === "1";
    const append = lite
      ? "content_ratings,keywords"
      : "content_ratings,aggregate_credits,videos,keywords";

    const data = await tmdbFetchJson(
      `https://api.themoviedb.org/3/tv/${id}?language=en-US&append_to_response=${append}`
    );

    const client = await clientPromise;
    const collection = client.db("teavie").collection("content");
    const probe = tmdbTvShowToPolicyProbe(data, numeric);
    const gate = await assertTvTmdbIdAllowed(numeric, { collection, probe });
    if (!gate.allowed) {
      return Response.json(
        {
          error: "content_policy",
          message: SHOW_UNAVAILABLE_MESSAGES.content_policy,
        },
        { status: 404 }
      );
    }

    return Response.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    console.error("GET /api/tv/details", err);
    return Response.json({ error: "Failed to fetch TV details" }, { status: 502 });
  }
}
