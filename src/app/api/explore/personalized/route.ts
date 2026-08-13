import { NextResponse } from "next/server";
import {
  loadPersonalizedCatalog,
} from "@/lib/api/personalizedRails";
import {
  getCachedPersonalizedExploreBundleWithExclude,
  PERSONALIZED_CACHE_HEADERS,
} from "@/lib/api/personalizedExploreCache";
import { resolveRequestPreferences } from "@/lib/api/resolveRequestPreferences";
import { hasUserPreferences } from "@/types/user";
import { createClient } from "@/utils/supabase/server";

async function loadWatchedMovieIds(userId: string | undefined): Promise<string[]> {
  if (!userId) return [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("watch_history")
      .select("catalog_id")
      .eq("user_id", userId)
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
      recommendedOnly?: boolean;
      excludeMovieIds?: unknown;
    };
    const preferences = await resolveRequestPreferences(body.preferences);

    if (!hasUserPreferences(preferences)) {
      return NextResponse.json({ items: [], bundle: null });
    }

    const bodyExclude = Array.isArray(body.excludeMovieIds)
      ? body.excludeMovieIds.map((id) => String(id ?? "").trim()).filter(Boolean)
      : [];

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const remoteExclude = await loadWatchedMovieIds(user?.id);
    const excludeMovieIds = [...new Set([...bodyExclude, ...remoteExclude])];

    const recommendedOnly = body.recommendedOnly === true;
    const wantsBundle = body.bundle === true || recommendedOnly;

    if (wantsBundle) {
      const bundle = await getCachedPersonalizedExploreBundleWithExclude(
        preferences,
        excludeMovieIds,
        { limit: 24, recommendedOnly }
      );
      return NextResponse.json(
        {
          items: bundle.recommended,
          bundle,
        },
        { headers: PERSONALIZED_CACHE_HEADERS }
      );
    }

    const { items } = await loadPersonalizedCatalog(preferences, {
      limit: 24,
      excludeMovieIds,
    });
    return NextResponse.json(
      { items, bundle: null },
      { headers: PERSONALIZED_CACHE_HEADERS }
    );
  } catch (err) {
    console.error("POST /api/explore/personalized", err);
    return NextResponse.json({ items: [], bundle: null }, { status: 500 });
  }
}
