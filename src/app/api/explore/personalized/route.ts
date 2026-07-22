import { NextResponse } from "next/server";
import {
  loadPersonalizedCatalog,
  loadPersonalizedExploreBundle,
} from "@/lib/api/personalizedRails";
import { resolveRequestPreferences } from "@/lib/api/resolveRequestPreferences";
import { hasUserPreferences } from "@/types/user";
import { createClient } from "@/utils/supabase/server";

async function loadWatchedMovieIds(): Promise<string[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
      .from("watch_history")
      .select("catalog_id")
      .eq("user_id", user.id)
      .eq("media_type", "movie")
      .limit(100);

    return (data ?? [])
      .map((row) => String(row.catalog_id ?? "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      preferences?: unknown;
      bundle?: boolean;
      excludeMovieIds?: unknown;
    };
    const preferences = await resolveRequestPreferences(body.preferences);

    if (!hasUserPreferences(preferences)) {
      return NextResponse.json({ items: [], bundle: null });
    }

    const bodyExclude = Array.isArray(body.excludeMovieIds)
      ? body.excludeMovieIds.map((id) => String(id ?? "").trim()).filter(Boolean)
      : [];
    const remoteExclude = await loadWatchedMovieIds();
    const excludeMovieIds = [...new Set([...bodyExclude, ...remoteExclude])];

    if (body.bundle) {
      const bundle = await loadPersonalizedExploreBundle(preferences, {
        limit: 24,
        excludeMovieIds,
      });
      return NextResponse.json({
        items: bundle.recommended,
        bundle,
      });
    }

    const { items } = await loadPersonalizedCatalog(preferences, {
      limit: 24,
      excludeMovieIds,
    });
    return NextResponse.json({ items, bundle: null });
  } catch (err) {
    console.error("POST /api/explore/personalized", err);
    return NextResponse.json({ items: [], bundle: null }, { status: 500 });
  }
}
