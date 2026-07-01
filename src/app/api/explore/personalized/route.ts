import { NextResponse } from "next/server";
import {
  loadPersonalizedCatalog,
  loadPersonalizedExploreBundle,
} from "@/lib/api/personalizedRails";
import { resolveRequestPreferences } from "@/lib/api/resolveRequestPreferences";
import { hasUserPreferences } from "@/types/user";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      preferences?: unknown;
      bundle?: boolean;
    };
    const preferences = await resolveRequestPreferences(body.preferences);

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
