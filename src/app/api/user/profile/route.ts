import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  normalizeUserPreferences,
  type UserPreferences,
} from "@/types/user";

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
      .from("profiles")
      .select("id, display_name, avatar_url, preferences, onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("GET /api/user/profile", error);
      return NextResponse.json({ error: "Profile fetch failed" }, { status: 500 });
    }

    if (!data) {
      const displayName =
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email?.split("@")[0] ??
        "User";
      const { data: created, error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          display_name: displayName,
          avatar_url: user.user_metadata?.avatar_url ?? null,
        })
        .select("id, display_name, avatar_url, preferences, onboarding_completed_at")
        .single();

      if (insertError) {
        console.error("GET /api/user/profile insert", insertError);
        return NextResponse.json({ error: "Profile create failed" }, { status: 500 });
      }

      return NextResponse.json({
        profile: {
          ...created,
          preferences: normalizeUserPreferences(created.preferences),
        },
        user: {
          id: user.id,
          email: user.email,
        },
      });
    }

    return NextResponse.json({
      profile: {
        ...data,
        preferences: normalizeUserPreferences(data.preferences),
      },
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("GET /api/user/profile", err);
    return NextResponse.json({ error: "Profile fetch failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
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
      display_name?: string;
      avatar_url?: string | null;
      preferences?: UserPreferences;
      onboarding_completed?: boolean;
    };

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.display_name === "string") {
      patch.display_name = body.display_name.trim().slice(0, 64) || null;
    }

    if (body.avatar_url === null) {
      patch.avatar_url = null;
    } else if (typeof body.avatar_url === "string") {
      patch.avatar_url = body.avatar_url.trim().slice(0, 2048) || null;
    }

    if (body.preferences) {
      patch.preferences = normalizeUserPreferences(body.preferences);
    }

    if (body.onboarding_completed === true) {
      patch.onboarding_completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, ...patch }, { onConflict: "id" })
      .select("id, display_name, avatar_url, preferences, onboarding_completed_at")
      .single();

    if (error) {
      console.error("PATCH /api/user/profile", error);
      return NextResponse.json({ error: "Profile update failed" }, { status: 500 });
    }

    return NextResponse.json({
      profile: {
        ...data,
        preferences: normalizeUserPreferences(data.preferences),
      },
    });
  } catch (err) {
    console.error("PATCH /api/user/profile", err);
    return NextResponse.json({ error: "Profile update failed" }, { status: 500 });
  }
}
