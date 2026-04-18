import { catalogTvIdsByTmdbIds } from "@/lib/catalogTvFromTmdb";

/**
 * Batch-resolve TMDB TV recommendation ids → Teavie catalog `id` (prefer `anime_*`).
 * Query: `?ids=949,100,101` (comma-separated, max 24)
 */
export async function GET(req) {
  try {
    const raw = new URL(req.url).searchParams.get("ids") || "";
    const nums = raw
      .split(/[,]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    const unique = [...new Set(nums)].slice(0, 24);
    if (unique.length === 0) {
      return Response.json({ map: {} });
    }
    const m = await catalogTvIdsByTmdbIds(unique);
    /** @type {Record<string, string>} */
    const map = {};
    for (const [k, v] of m) map[String(k)] = v;
    return Response.json({ map });
  } catch (e) {
    console.error(e);
    return Response.json({ map: {}, error: "lookup failed" }, { status: 500 });
  }
}
