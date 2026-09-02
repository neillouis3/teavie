import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Supabase SSR auth cookies (chunked `sb-*-auth-token.*`). */
function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => {
    const name = cookie.name.toLowerCase();
    return name.includes("auth-token") || /^sb-/.test(name);
  });
}

const PUBLIC_GET_API_PREFIXES = [
  "/api/explore",
  "/api/genre",
  "/api/category",
  "/api/tmdb",
  "/api/search",
  "/api/discover",
  "/api/movies",
  "/api/shows",
  "/api/anime",
  "/api/anilist",
  "/api/catalog/stats",
];

/**
 * Skip Supabase session refresh for cached public catalog GETs (saves edge + origin).
 * Mutating routes and `/api/user/*` still refresh when auth cookies exist.
 */
export function shouldSkipSessionRefresh(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  if (pathname.startsWith("/api/user/")) return false;
  if (pathname.startsWith("/api/explore/personalized")) return false;
  if (pathname.startsWith("/api/catalog/history")) return false;

  if (method !== "GET" && method !== "HEAD") return false;

  return PUBLIC_GET_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Refresh the Supabase auth session and forward updated cookies. */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  if (!hasSupabaseAuthCookie(request)) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  await supabase.auth.getUser();

  return supabaseResponse;
}
