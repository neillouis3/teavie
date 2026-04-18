import { runDailyMovieSync } from "@/lib/syncMoviesTmdbDaily";

/** Vercel / long-running hosts: full TMDB movie sync (same as `node scripts/sync-movies-tmdb-daily.mjs`). */
export const maxDuration = 300;

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dry_run") === "1";
  const staleCap = Math.min(2000, Math.max(0, parseInt(searchParams.get("stale_cap") || "250", 10)));
  const maxDiscoverPages = Math.min(60, Math.max(1, parseInt(searchParams.get("max_discover_pages") || "40", 10)));

  try {
    const result = await runDailyMovieSync({
      dryRun,
      staleCap,
      maxDiscoverPages,
      onLog: () => {},
    });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
