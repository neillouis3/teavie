import { clientIpFromRequest, hasStremioAddons, resolveStremioStreams } from "@/lib/stremio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Allow slow debrid/scraper addons to finish before the route is cut off. */
export const maxDuration = 60;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  const imdbId = params.get("id")?.trim() ?? "";
  const season = Number(params.get("season"));
  const episode = Number(params.get("episode"));
  const fallback = params.get("fallback") === "1";
  const userAgent = request.headers.get("user-agent") ?? "";
  const preferSafari = /safari/i.test(userAgent) && !/(chrome|chromium|crios|android)/i.test(userAgent);

  if (type !== "movie" && type !== "series") {
    return Response.json({ error: "type must be movie or series" }, { status: 400 });
  }
  if (!/^tt\d+$/i.test(imdbId)) {
    return Response.json({ error: "A valid IMDb id is required" }, { status: 400 });
  }
  if (!hasStremioAddons()) {
    return Response.json(
      { error: "No Stremio addons are configured", code: "not_configured" },
      { status: 503 }
    );
  }

  let resourceId = imdbId.toLowerCase();
  if (type === "series") {
    if (!Number.isInteger(season) || season < 0 || !Number.isInteger(episode) || episode < 1) {
      return Response.json({ error: "A valid season and episode are required" }, { status: 400 });
    }
    resourceId += `:${season}:${episode}`;
  }

  try {
    const clientIp = clientIpFromRequest(request);
    const result = await resolveStremioStreams(
      type,
      resourceId,
      fallback ? 1 : 0,
      preferSafari,
      clientIp
    );
    if (result.streams.length > 0) {
      result.streams = result.streams.map((stream, index) => {
        const endpointParams = new URLSearchParams({
          type,
          id: resourceId,
          index: String(index),
          fallback: fallback ? "1" : "0",
          safari: preferSafari ? "1" : "0",
        }).toString();
        return {
          ...stream,
          url: stream.url,
          remuxUrl: `/api/streams/remux?${endpointParams}`,
          audioTracksUrl: `/api/streams/tracks?${endpointParams}`,
        };
      });
    }
    return Response.json(result, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("GET /api/streams", error);
    return Response.json(
      {
        error: "The configured stream addon could not be reached.",
        code: "addon_unavailable",
      },
      { status: 502 }
    );
  }
}
