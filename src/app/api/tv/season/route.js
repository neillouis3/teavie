import { tmdbBearerToken } from "@/lib/tmdbAuth";

function todayYmdUtc() {
  return new Date().toISOString().slice(0, 10);
}

function episodeAired(airDate, todayYmd) {
  const ad = String(airDate ?? "").trim();
  if (ad.length < 10) return true;
  return ad <= todayYmd;
}

/**
 * GET /api/tv/season?tvId=1399&season=1
 * Returns aired episodes for a TMDB TV season (name, runtime, still_path, air_date).
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const tvId = searchParams.get("tvId")?.trim();
    const seasonRaw = searchParams.get("season");

    if (!tvId || !/^\d+$/.test(tvId)) {
      return Response.json({ error: "Invalid tvId" }, { status: 400 });
    }

    const seasonNum = parseInt(String(seasonRaw ?? ""), 10);
    if (!Number.isFinite(seasonNum) || seasonNum < 0) {
      return Response.json({ error: "Invalid season" }, { status: 400 });
    }

    const token = tmdbBearerToken();
    if (!token) {
      return Response.json({ error: "TMDB not configured" }, { status: 503 });
    }

    const res = await fetch(
      `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNum}?language=en-US`,
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) {
      return Response.json(
        { error: "Season not found" },
        { status: res.status === 404 ? 404 : 502 }
      );
    }

    const json = await res.json();
    const today = todayYmdUtc();

    const episodes = (json.episodes ?? [])
      .map((ep) => ({
        episode_number: Number(ep.episode_number),
        name:
          typeof ep.name === "string" && ep.name.trim()
            ? ep.name.trim()
            : `Episode ${ep.episode_number}`,
        runtime:
          typeof ep.runtime === "number" && ep.runtime > 0 ? ep.runtime : null,
        air_date: ep.air_date ?? null,
        still_path:
          typeof ep.still_path === "string" && ep.still_path.trim()
            ? ep.still_path.trim()
            : null,
      }))
      .filter(
        (ep) =>
          Number.isFinite(ep.episode_number) &&
          ep.episode_number > 0 &&
          episodeAired(ep.air_date, today)
      )
      .sort((a, b) => a.episode_number - b.episode_number);

    return Response.json({
      tvId,
      season: seasonNum,
      episodes,
    });
  } catch (err) {
    console.error("[tv/season]", err);
    return Response.json({ error: "Failed to fetch season" }, { status: 500 });
  }
}
