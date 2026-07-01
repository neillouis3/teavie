import { createClient } from "@/utils/supabase/server";
import { normalizeUserPreferences, hasUserPreferences } from "@/types/user";

/**
 * Resolve preferences from a request body, falling back to the signed-in profile.
 * @param {unknown} bodyPreferences
 */
export async function resolveRequestPreferences(bodyPreferences) {
  let preferences = normalizeUserPreferences(bodyPreferences);

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
