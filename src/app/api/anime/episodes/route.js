/**
 * GET /api/anime/episodes?imdbId=tt2560140&season=1&limit=200
 * GET /api/anime/episodes?malId=25777&season=1&limit=200
 *
 * Prefers OMDb season listings when an IMDb id is known (catalog or title search).
 * Falls back to Jikan (MAL) when anime has no IMDb id — common for catalog-only rows.
 */
import clientPromise from "@/lib/mongo";
import { fetchOmdbSeasonEpisodes, pickImdbIdFromDoc } from "@/lib/omdbEpisodes";
import { fetchJikanAnimeEpisodes } from "@/lib/jikanEpisodes";
import { resolveOmdbImdbIdForDoc } from "@/lib/omdbResolve";

async function catalogDocForMalId(malId) {
  const client = await clientPromise;
  const col = client.db("teavie").collection("content");
  return col.findOne(
    {
      type: "tv",
      $or: [{ mal_id: malId }, { id: `anime_${malId}` }],
    },
    {
      projection: {
        id: 1,
        title: 1,
        name: 1,
        first_air_date: 1,
        release_date: 1,
        imdb_id: 1,
        external_ids: 1,
        anilist: 1,
      },
    }
  );
}

async function imdbIdForMalId(malId) {
  const doc = await catalogDocForMalId(malId);
  if (!doc) return null;

  const fromDoc = pickImdbIdFromDoc(doc);
  if (fromDoc) return fromDoc;

  return resolveOmdbImdbIdForDoc(doc, "tv");
}

function capEpisodes(episodes, limit) {
  if (!Array.isArray(episodes)) return [];
  if (Number.isFinite(limit) && limit > 0 && limit < episodes.length) {
    return episodes.slice(0, limit);
  }
  return episodes;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const imdbRaw = String(searchParams.get("imdbId") ?? "").trim();
    const malId = parseInt(searchParams.get("malId") ?? "", 10);
    const season = Math.max(1, parseInt(searchParams.get("season") ?? "1", 10) || 1);
    const limit = Math.min(
      500,
      Math.max(1, parseInt(searchParams.get("limit") || "200", 10))
    );
    const hasMal = Number.isFinite(malId) && malId > 0;

    let imdbId = /^tt\d+$/i.test(imdbRaw) ? imdbRaw : null;
    if (!imdbId && hasMal) {
      imdbId = await imdbIdForMalId(malId);
    }

    if (imdbId) {
      const episodes = await fetchOmdbSeasonEpisodes(imdbId, season);
      if (episodes.length > 0) {
        const capped = capEpisodes(episodes, limit);
        return Response.json({
          source: "omdb",
          imdbId,
          season,
          malId: hasMal ? malId : null,
          episodeCount: episodes.length,
          episodes: capped,
        });
      }
    }

    if (hasMal) {
      const episodes = await fetchJikanAnimeEpisodes(malId, limit);
      if (episodes.length > 0) {
        return Response.json({
          source: "jikan",
          imdbId: imdbId ?? null,
          season,
          malId,
          episodeCount: episodes.length,
          episodes,
        });
      }
    }

    return Response.json(
      {
        error: hasMal
          ? "No episodes found (OMDb and Jikan)"
          : "Provide imdbId or malId",
      },
      { status: 404 }
    );
  } catch (err) {
    console.error("[anime/episodes]", err);
    if (err?.code === "OMDB_RATE_LIMIT") {
      return Response.json({ error: "OMDb rate limit reached" }, { status: 429 });
    }
    return Response.json({ error: "Failed to fetch anime episodes" }, { status: 500 });
  }
}
