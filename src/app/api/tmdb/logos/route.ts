import { NextResponse } from "next/server";
import { fetchTmdbTitleLogoPath } from "@/lib/api/tmdbTitleLogo";

/**
 * Batch-fetch TMDB title logos for hero overlays.
 * Body: { items: [{ id: string|number, type: "movie"|"tv" }] }
 * Response: { logos: Record<"movie:123"|"tv:456", string> } // file_path values
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      items?: { id?: unknown; type?: unknown }[];
    };
    const raw = Array.isArray(body.items) ? body.items : [];
    const seen = new Set<string>();
    const items: { id: string; type: "movie" | "tv"; key: string }[] = [];

    for (const row of raw) {
      const id = String(row?.id ?? "").trim();
      if (!id || !/^\d+$/.test(id)) continue;
      const type: "movie" | "tv" = row?.type === "tv" ? "tv" : "movie";
      const key = `${type}:${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ id, type, key });
      if (items.length >= 24) break;
    }

    if (items.length === 0) {
      return NextResponse.json({ logos: {} });
    }

    const entries = await Promise.all(
      items.map(async ({ id, type, key }) => {
        const path = await fetchTmdbTitleLogoPath(type, id);
        return path ? ([key, path] as const) : null;
      })
    );

    const logos = Object.fromEntries(
      entries.filter((e): e is readonly [string, string] => e != null)
    );

    return NextResponse.json({ logos });
  } catch (err) {
    console.error("POST /api/tmdb/logos", err);
    return NextResponse.json({ logos: {} }, { status: 500 });
  }
}
