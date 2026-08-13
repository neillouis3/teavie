import { isValidImdbGenreSlug } from "@/lib/imdbGenres";
import { loadGenrePage } from "@/lib/api/genreRail";
import { resolveRequestPreferences } from "@/lib/api/resolveRequestPreferences";
import {
  GENRE_PAGE_CACHE_HEADERS,
  getCachedGenrePage,
} from "@/lib/api/genrePageCache";

async function handleGenrePage(slug, type, limit, preferences = null, part = null) {
  if (!isValidImdbGenreSlug(slug)) {
    return Response.json({ error: "Invalid genre" }, { status: 400 });
  }

  const payload =
    preferences == null
      ? await getCachedGenrePage(slug, type, limit, part)
      : await loadGenrePage(slug, type, limit, preferences, part);

  if (payload.error) {
    return Response.json({ error: payload.error }, { status: payload.status ?? 400 });
  }

  return Response.json(payload, { headers: GENRE_PAGE_CACHE_HEADERS });
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug")?.trim() ?? "";
    const type = searchParams.get("type")?.trim() || "all";
    const part = searchParams.get("part")?.trim() || null;
    const limitRaw = searchParams.get("limit");
    const limit = limitRaw ? Math.min(48, Math.max(1, parseInt(limitRaw, 10))) : 24;

    return handleGenrePage(slug, type, limit, null, part);
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
    const part = body.part?.trim() || null;
    const limit = Math.min(48, Math.max(1, body.limit ?? 24));
    const preferences = await resolveRequestPreferences(body.preferences);

    return handleGenrePage(slug, type, limit, preferences, part);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Genre page failed" }, { status: 500 });
  }
}
