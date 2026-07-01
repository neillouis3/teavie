import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  loadPersonalizedCatalog,
  loadPersonalizedExploreBundle,
} from "@/lib/api/personalizedRails";
import { normalizeUserPreferences, hasUserPreferences } from "@/types/user";

async function resolvePreferences(body: { preferences?: unknown }) {
  let preferences = normalizeUserPreferences(body.preferences);

  if (!hasUserPreferences(preferences)) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", user.id)
        .maybeSingle();
      preferences = normalizeUserPreferences(data?.preferences);
    }
  }

  return preferences;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      preferences?: unknown;
      bundle?: boolean;
    };
    const preferences = await resolvePreferences(body);

    if (!hasUserPreferences(preferences)) {
      return NextResponse.json({ items: [], bundle: null });
    }

    if (body.bundle) {
      const bundle = await loadPersonalizedExploreBundle(preferences, { limit: 24 });
      return NextResponse.json({
        items: bundle.recommended,
        bundle,
      });
    }

    const { items } = await loadPersonalizedCatalog(preferences, { limit: 24 });
    return NextResponse.json({ items, bundle: null });
  } catch (err) {
    console.error("POST /api/explore/personalized", err);
    return NextResponse.json({ items: [], bundle: null }, { status: 500 });
  }
}
