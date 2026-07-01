import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { WatchProgressPayload } from "@/lib/watchProgress";

export async function GET(req: Request) {
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

    if (catalogId) {
      const { data, error } = await supabase
        .from("watch_progress")
        .select("catalog_id, progress, movie_position_seconds")
        .eq("user_id", user.id)
        .eq("catalog_id", catalogId)
        .maybeSingle();

      if (error) {
        console.error("GET /api/user/watch-progress", error);
        return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
      }

      return NextResponse.json({
        progress: data?.progress ?? null,
        moviePositionSeconds: data?.movie_position_seconds ?? 0,
      });
    }

    const { data, error } = await supabase
      .from("watch_progress")
      .select("catalog_id, progress, movie_position_seconds")
      .eq("user_id", user.id);

    if (error) {
      console.error("GET /api/user/watch-progress", error);
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    console.error("GET /api/user/watch-progress", err);
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
      catalogId?: string;
      progress?: Omit<WatchProgressPayload, "v"> | null;
      moviePositionSeconds?: number;
      rows?: {
        catalogId: string;
        progress?: Omit<WatchProgressPayload, "v"> | null;
        moviePositionSeconds?: number;
      }[];
    };

    if (Array.isArray(body.rows) && body.rows.length > 0) {
      const upsertRows = body.rows
        .map((row) => {
          const catalogId = String(row.catalogId ?? "").trim();
          if (!catalogId) return null;
          return {
            user_id: user.id,
            catalog_id: catalogId,
            progress: row.progress ?? {},
            movie_position_seconds: Math.max(
              0,
              Math.floor(Number(row.moviePositionSeconds)) || 0
            ),
            updated_at: new Date().toISOString(),
          };
        })
        .filter((row): row is NonNullable<typeof row> => row != null);

      const { error } = await supabase.from("watch_progress").upsert(upsertRows, {
        onConflict: "user_id,catalog_id",
      });

      if (error) {
        console.error("POST /api/user/watch-progress bulk", error);
        return NextResponse.json({ error: "Save failed" }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    const catalogId = String(body.catalogId ?? "").trim();
    if (!catalogId) {
      return NextResponse.json({ error: "catalogId required" }, { status: 400 });
    }

    const { error } = await supabase.from("watch_progress").upsert(
      {
        user_id: user.id,
        catalog_id: catalogId,
        progress: body.progress ?? {},
        movie_position_seconds: Math.max(
          0,
          Math.floor(Number(body.moviePositionSeconds)) || 0
        ),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,catalog_id" }
    );

    if (error) {
      console.error("POST /api/user/watch-progress", error);
      return NextResponse.json({ error: "Save failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/user/watch-progress", err);
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
      .from("watch_progress")
      .delete()
      .eq("user_id", user.id)
      .eq("catalog_id", catalogId);

    if (error) {
      console.error("DELETE /api/user/watch-progress", error);
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/user/watch-progress", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
