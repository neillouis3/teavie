import {
  attachStreamEndpoints,
  clientIpFromRequest,
  resolveStremioStreams,
  stremioAddonCount,
} from "@/lib/stremio/client";
import { parseStreamsRequest } from "@/lib/stremio/parseStreamsRequest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Allow slow debrid/scraper addons to finish before the route is cut off. */
export const maxDuration = 60;

export async function GET(request: Request) {
  const parsed = parseStreamsRequest(request);
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.error, code: parsed.code },
      { status: parsed.status }
    );
  }

  const { type, resourceId, addonIndex, caps } = parsed;

  try {
    const clientIp = clientIpFromRequest(request);
    const result = await resolveStremioStreams(type, resourceId, addonIndex, caps, clientIp);
    if (result.streams.length > 0) {
      result.streams = attachStreamEndpoints(result.streams, {
        type,
        resourceId,
        addonIndex,
        caps,
      });
    }
    return Response.json(
      {
        ...result,
        addonIndex,
        hasMoreAddons: addonIndex + 1 < stremioAddonCount(),
      },
      {
        headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
      }
    );
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
