import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      watchLater?: { catalogId: string; mediaType: "movie" | "tv"; addedAt?: number }[];
      watchHistory?: {
        catalogId: string;
        mediaType: "movie" | "tv";
        lastSeason?: number;
        lastEpisode?: number;
        lastWatchedAt?: number;
      }[];
      progressRows?: {
        catalogId: string;
        progress?: Record<string, unknown>;
        moviePositionSeconds?: number;
      }[];
    };

    if (Array.isArray(body.watchHistory) && body.watchHistory.length > 0) {
      const rows = body.watchHistory.map((entry) => ({
        user_id: user.id,
        catalog_id: entry.catalogId,
        media_type: entry.mediaType,
        last_season: Math.max(1, Math.floor(Number(entry.lastSeason)) || 1),
        last_episode: Math.max(1, Math.floor(Number(entry.lastEpisode)) || 1),
        last_watched_at: new Date(entry.lastWatchedAt ?? Date.now()).toISOString(),
      }));
      await supabase.from("watch_history").upsert(rows, {
        onConflict: "user_id,catalog_id",
      });
    }

    if (Array.isArray(body.watchLater) && body.watchLater.length > 0) {
      const rows = body.watchLater.map((entry) => ({
        user_id: user.id,
        catalog_id: entry.catalogId,
        media_type: entry.mediaType,
        added_at: new Date(entry.addedAt ?? Date.now()).toISOString(),
      }));
      await supabase.from("watch_later").upsert(rows, {
        onConflict: "user_id,catalog_id",
      });
    }

    if (Array.isArray(body.progressRows) && body.progressRows.length > 0) {
      const rows = body.progressRows.map((row) => ({
        user_id: user.id,
        catalog_id: row.catalogId,
        progress: row.progress ?? {},
        movie_position_seconds: Math.max(
          0,
          Math.floor(Number(row.moviePositionSeconds)) || 0
        ),
        updated_at: new Date().toISOString(),
      }));
      await supabase.from("watch_progress").upsert(rows, {
        onConflict: "user_id,catalog_id",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/user/sync", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
