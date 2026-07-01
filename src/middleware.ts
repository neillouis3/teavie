import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isHiddenSplitCourMal,
  normalizeSplitCourMalEpisode,
  primaryMalForSplitCourMal,
} from "@/lib/animeSplitCour.js";
import { updateSession } from "@/utils/supabase/middleware";

/** Redirect hidden split-cour anime rows to their merged primary show page. */
function splitCourRedirect(request: NextRequest): NextResponse | null {
  const match = request.nextUrl.pathname.match(/^\/shows\/anime_(\d+)$/);
  if (!match) return null;

  const mal = parseInt(match[1], 10);
  if (!Number.isFinite(mal) || !isHiddenSplitCourMal(mal)) {
    return null;
  }

  const primary = primaryMalForSplitCourMal(mal);
  if (primary == null || primary === mal) return null;

  const partEp = parseInt(request.nextUrl.searchParams.get("episode") ?? "1", 10);
  const { episode: mergedEp } = normalizeSplitCourMalEpisode(
    mal,
    Number.isFinite(partEp) && partEp >= 1 ? partEp : 1
  );

  const url = request.nextUrl.clone();
  url.pathname = `/shows/anime_${primary}`;
  url.searchParams.set("episode", String(mergedEp));
  return NextResponse.redirect(url, 307);
}

export async function middleware(request: NextRequest) {
  const redirect = splitCourRedirect(request);
  if (redirect) return redirect;

  return updateSession(request);
}

export const config = {
  matcher: [
    "/shows/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
