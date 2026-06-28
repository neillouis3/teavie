import { loadAnimeShowRails } from "@/lib/api/animeShowRails";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const malRaw = searchParams.get("idMal");
    const idMal = malRaw ? parseInt(malRaw, 10) : NaN;
    const limitRaw = searchParams.get("limit");
    const parsedLimit = limitRaw ? parseInt(limitRaw, 10) : NaN;
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 24)
        : 14;

    if (!Number.isFinite(idMal) || idMal <= 0) {
      return Response.json(
        { error: "Provide idMal (MAL anime id)", related: [], youMightLike: [] },
        { status: 400 }
      );
    }

    const payload = await loadAnimeShowRails(idMal, limit);
    return Response.json(payload);
  } catch (err) {
    console.error("[anilist/show-rails]", err);
    return Response.json({ related: [], youMightLike: [] }, { status: 200 });
  }
}
