import { loadAnimeRelatedItems } from "@/lib/api/animeShowRails";

/**
 * Related anime: franchise rail with catalog poster/backdrop metadata from Mongo.
 * GET `?idMal=` (MAL id of the current show).
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const malRaw = searchParams.get("idMal");
    const idMal = malRaw ? parseInt(malRaw, 10) : NaN;

    if (!Number.isFinite(idMal) || idMal <= 0) {
      return Response.json(
        { error: "Provide idMal (MAL anime id)", items: [] },
        { status: 400 }
      );
    }

    const items = await loadAnimeRelatedItems(idMal, {
      includeChain: searchParams.get("chain") !== "0",
    });
    return Response.json(
      { items },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
        },
      }
    );
  } catch (err) {
    console.error("[anilist/related]", err);
    return Response.json({ error: "related failed", items: [] }, { status: 200 });
  }
}
