import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { WatchHistoryEntry } from "@/lib/watchHistory";

function parseEntry(row: unknown): WatchHistoryEntry | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const catalogId = String(o.catalogId ?? o.catalog_id ?? "").trim();
  const mediaType = o.mediaType === "movie" || o.media_type === "movie" ? "movie" : "tv";
  if (!catalogId) return null;
  return {
    catalogId,
    mediaType,
    lastWatchedAt: Number(o.lastWatchedAt ?? o.last_watched_at ?? Date.now()),
    lastSeason: Math.max(1, Math.floor(Number(o.lastSeason ?? o.last_season)) || 1),
    lastEpisode: Math.max(1, Math.floor(Number(o.lastEpisode ?? o.last_episode)) || 1),
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("watch_history")
      .select("catalog_id, media_type, last_season, last_episode, last_watched_at")
      .eq("user_id", user.id)
      .order("last_watched_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("GET /api/user/watch-history", error);
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    const entries = (data ?? []).map((row) => ({
      catalogId: row.catalog_id,
      mediaType: row.media_type as "movie" | "tv",
      lastSeason: row.last_season,
      lastEpisode: row.last_episode,
      lastWatchedAt: new Date(row.last_watched_at).getTime(),
    }));

    return NextResponse.json({ entries });
  } catch (err) {
    console.error("GET /api/user/watch-history", err);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}

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
      entry?: unknown;
      entries?: unknown[];
    };

    const parsed = body.entry
      ? [parseEntry(body.entry)].filter((e): e is WatchHistoryEntry => e != null)
      : Array.isArray(body.entries)
        ? body.entries.map(parseEntry).filter((e): e is WatchHistoryEntry => e != null)
        : [];

    if (parsed.length === 0) {
      return NextResponse.json({ error: "No entries" }, { status: 400 });
    }

    const rows = parsed.map((entry) => ({
      user_id: user.id,
      catalog_id: entry.catalogId,
      media_type: entry.mediaType,
      last_season: entry.lastSeason,
      last_episode: entry.lastEpisode,
      last_watched_at: new Date(entry.lastWatchedAt || Date.now()).toISOString(),
    }));

    const { error } = await supabase.from("watch_history").upsert(rows, {
      onConflict: "user_id,catalog_id",
    });

    if (error) {
      console.error("POST /api/user/watch-history", error);
      return NextResponse.json({ error: "Save failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/user/watch-history", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const catalogId = searchParams.get("catalogId")?.trim();
    if (!catalogId) {
      return NextResponse.json({ error: "catalogId required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("watch_history")
      .delete()
      .eq("user_id", user.id)
      .eq("catalog_id", catalogId);

    if (error) {
      console.error("DELETE /api/user/watch-history", error);
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/user/watch-history", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
