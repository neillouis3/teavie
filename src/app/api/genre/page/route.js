import { isValidImdbGenreSlug } from "@/lib/imdbGenres";
import { loadGenrePage } from "@/lib/api/genreRail";
import { resolveRequestPreferences } from "@/lib/api/resolveRequestPreferences";

async function handleGenrePage(slug, type, limit, preferences = null) {
  if (!isValidImdbGenreSlug(slug)) {
    return Response.json({ error: "Invalid genre" }, { status: 400 });
  }

  const payload = await loadGenrePage(slug, type, limit, preferences);
  if (payload.error) {
    return Response.json({ error: payload.error }, { status: payload.status ?? 400 });
  }

  return Response.json(payload);
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug")?.trim() ?? "";
    const type = searchParams.get("type")?.trim() || "all";
    const limitRaw = searchParams.get("limit");
    const limit = limitRaw ? Math.min(48, Math.max(1, parseInt(limitRaw, 10))) : 24;

    return handleGenrePage(slug, type, limit);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Genre page failed" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const slug = body.slug?.trim() ?? "";
    const type = body.type?.trim() || "all";
    const limit = Math.min(48, Math.max(1, body.limit ?? 24));
    const preferences = await resolveRequestPreferences(body.preferences);

    return handleGenrePage(slug, type, limit, preferences);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Genre page failed" }, { status: 500 });
  }
}
