import { isValidImdbGenreSlug } from "@/lib/imdbGenres";
import { loadGenrePage } from "@/lib/api/genreRail";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug")?.trim() ?? "";
    const type = searchParams.get("type")?.trim() || "all";
    const limitRaw = searchParams.get("limit");
    const limit = limitRaw ? Math.min(48, Math.max(1, parseInt(limitRaw, 10))) : 24;

    if (!isValidImdbGenreSlug(slug)) {
      return Response.json({ error: "Invalid genre" }, { status: 400 });
    }

    const payload = await loadGenrePage(slug, type, limit);
    if (payload.error) {
      return Response.json({ error: payload.error }, { status: payload.status ?? 400 });
    }

    return Response.json(payload);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Genre page failed" }, { status: 500 });
  }
}
