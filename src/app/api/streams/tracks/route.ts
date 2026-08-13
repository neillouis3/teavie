import { clientIpFromRequest, resolveStremioStreams } from "@/lib/stremio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  const resourceId = params.get("id")?.trim() ?? "";
  const index = Number(params.get("index") ?? "0");
  const addonIndex = Math.max(
    0,
    Number.parseInt(params.get("addonIndex") ?? (params.get("fallback") === "1" ? "1" : "0"), 10) || 0
  );
  const preferSafari = params.get("safari") === "1";
  if (
    (type !== "movie" && type !== "series") ||
    !/^tt\d+(?::\d+:\d+)?$/i.test(resourceId) ||
    !Number.isInteger(index) ||
    index < 0
  ) {
    return Response.json({ error: "Invalid stream request" }, { status: 400 });
  }

  const result = await resolveStremioStreams(
    type,
    resourceId,
    addonIndex,
    preferSafari,
    clientIpFromRequest(request)
  );
  const stream = result.streams[index];
  if (!stream) {
    return Response.json({ error: "Stream is no longer available" }, { status: 404 });
  }

  // Do not ffprobe stream URLs from the server — IP-pinned hosts (ElfHosted, etc.)
  // would lock the link to Vercel before the viewer's browser can play it.
  return Response.json({ tracks: [] });
}
