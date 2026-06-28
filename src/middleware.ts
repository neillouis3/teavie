import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isHiddenSplitCourMal,
  normalizeSplitCourMalEpisode,
  primaryMalForSplitCourMal,
} from "@/lib/animeSplitCour.js";

/** Redirect hidden split-cour anime rows to their merged primary show page. */
export function middleware(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/shows\/anime_(\d+)$/);
  if (!match) return NextResponse.next();

  const mal = parseInt(match[1], 10);
  if (!Number.isFinite(mal) || !isHiddenSplitCourMal(mal)) {
    return NextResponse.next();
  }

  const primary = primaryMalForSplitCourMal(mal);
  if (primary == null || primary === mal) return NextResponse.next();

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

export const config = {
  matcher: ["/shows/:path*"],
};
