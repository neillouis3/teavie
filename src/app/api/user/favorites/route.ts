import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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
      .from("favorites")
      .select("catalog_id, media_type, added_at")
      .eq("user_id", user.id)
      .order("added_at", { ascending: false })
      .limit(96);

    if (error) {
      console.error("GET /api/user/favorites", error);
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    const entries = (data ?? []).map((row) => ({
      catalogId: row.catalog_id,
      mediaType: row.media_type as "movie" | "tv",
      addedAt: new Date(row.added_at).getTime(),
    }));

    return NextResponse.json({ entries });
  } catch (err) {
    console.error("GET /api/user/favorites", err);
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
      mediaType?: "movie" | "tv";
      entries?: { catalogId: string; mediaType: "movie" | "tv"; addedAt?: number }[];
    };

    if (Array.isArray(body.entries) && body.entries.length > 0) {
      const rows = body.entries
        .map((entry) => {
          const catalogId = String(entry.catalogId ?? "").trim();
          if (!catalogId) return null;
          return {
            user_id: user.id,
            catalog_id: catalogId,
            media_type: entry.mediaType === "movie" ? "movie" : "tv",
            added_at: new Date(entry.addedAt ?? Date.now()).toISOString(),
          };
        })
        .filter((row): row is NonNullable<typeof row> => row != null);

      const { error } = await supabase.from("favorites").upsert(rows, {
        onConflict: "user_id,catalog_id",
      });

      if (error) {
        console.error("POST /api/user/favorites bulk", error);
        return NextResponse.json({ error: "Save failed" }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    const catalogId = String(body.catalogId ?? "").trim();
    const mediaType = body.mediaType === "movie" ? "movie" : "tv";
    if (!catalogId) {
      return NextResponse.json({ error: "catalogId required" }, { status: 400 });
    }

    const { error } = await supabase.from("favorites").upsert(
      {
        user_id: user.id,
        catalog_id: catalogId,
        media_type: mediaType,
        added_at: new Date().toISOString(),
      },
      { onConflict: "user_id,catalog_id" }
    );

    if (error) {
      console.error("POST /api/user/favorites", error);
      return NextResponse.json({ error: "Save failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/user/favorites", err);
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
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("catalog_id", catalogId);

    if (error) {
      console.error("DELETE /api/user/favorites", error);
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/user/favorites", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
