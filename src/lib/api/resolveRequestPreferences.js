import { createClient } from "@/utils/supabase/server";
import { normalizeUserPreferences } from "@/types/user";

/**
 * Signed-in users always use profile preferences from Supabase.
 * Guests fall back to an optional request body (usually empty).
 * @param {unknown} bodyPreferences
 */
export async function resolveRequestPreferences(bodyPreferences) {
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
    return normalizeUserPreferences(data?.preferences);
  }

  return normalizeUserPreferences(bodyPreferences);
}
