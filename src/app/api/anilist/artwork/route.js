import { loadAnimeArtwork } from "@/lib/api/animeArtwork";

/**
 * Anime artwork gallery (MAL pictures, AniList fallback).
 * GET `?idMal=`
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

    const items = await loadAnimeArtwork(idMal);
    return Response.json(
      { items },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
        },
      }
    );
  } catch (err) {
    console.error("[anilist/artwork]", err);
    return Response.json({ error: "artwork failed", items: [] }, { status: 200 });
  }
}
