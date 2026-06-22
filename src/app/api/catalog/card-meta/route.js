/**
 * Batch card metadata for rails (runtime, seasons, episodes).
 * GET ?type=movie|tv&ids=66732,550,anime_123
 */
import clientPromise from "@/lib/mongo";
import {
  runtimeSecondsFromDoc,
  tvEpisodeCountFromDoc,
  tvSeasonCountFromDoc,
} from "@/lib/mapContentDocToItem";

function parseIds(raw) {
  return [...new Set(String(raw ?? "").split(",").map((s) => s.trim()).filter(Boolean))].slice(
    0,
    32
  );
}

function metaFromDoc(doc) {
  return {
    runtimeSeconds: runtimeSecondsFromDoc(doc),
    seasonAmount: tvSeasonCountFromDoc(doc) ?? 0,
    numberOfEpisodes: tvEpisodeCountFromDoc(doc),
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") === "movie" ? "movie" : "tv";
    const ids = parseIds(searchParams.get("ids"));
    if (ids.length === 0) {
      return Response.json({ meta: {} });
    }

    const numeric = ids
      .map((id) => Number(id))
      .filter((n) => Number.isFinite(n) && n > 0);

    const or = [{ id: { $in: ids } }];
    if (numeric.length) {
      or.push({ id: { $in: numeric } }, { tmdb_id: { $in: numeric } });
    }

    const client = await clientPromise;
    const docs = await client
      .db("teavie")
      .collection("content")
      .find(
        { type, $or: or },
        {
          projection: {
            id: 1,
            tmdb_id: 1,
            runtimeSeconds: 1,
            runtime: 1,
            season_amount: 1,
            number_of_seasons: 1,
            number_of_episodes: 1,
            anilist: 1,
          },
        }
      )
      .toArray();

    /** @type {Record<string, ReturnType<typeof metaFromDoc>>} */
    const meta = {};

    for (const doc of docs) {
      const payload = metaFromDoc(doc);
      const keys = new Set([String(doc.id)]);
      if (typeof doc.tmdb_id === "number" && doc.tmdb_id > 0) {
        keys.add(String(doc.tmdb_id));
      }
      for (const key of keys) {
        if (ids.includes(key)) meta[key] = payload;
      }
    }

    return Response.json({ meta });
  } catch (err) {
    console.error("GET /api/catalog/card-meta", err);
    return Response.json({ meta: {} }, { status: 500 });
  }
}
