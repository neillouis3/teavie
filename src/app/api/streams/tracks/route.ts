import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { resolveStremioStreams } from "@/lib/stremio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  const resourceId = params.get("id")?.trim() ?? "";
  const index = Number(params.get("index") ?? "0");
  const fallback = params.get("fallback") === "1";
  const preferSafari = params.get("safari") === "1";
  if ((type !== "movie" && type !== "series") || !/^tt\d+(?::\d+:\d+)?$/i.test(resourceId) || !Number.isInteger(index) || index < 0) {
    return Response.json({ error: "Invalid stream request" }, { status: 400 });
  }
  const result = await resolveStremioStreams(type, resourceId, fallback ? 1 : 0, preferSafari);
  const stream = result.streams[index];
  if (!stream) return Response.json({ error: "Stream is no longer available" }, { status: 404 });
  try {
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-user_agent", "Mozilla/5.0 Safari/605.1.15", "-select_streams", "a", "-show_entries", "stream=codec_name,channels:stream_tags=language,title", "-of", "json", stream.url], { timeout: 20_000, maxBuffer: 1024 * 1024 });
    const payload = JSON.parse(stdout) as { streams?: Array<{ codec_name?: string; channels?: number; tags?: { language?: string; title?: string } }> };
    return Response.json({ tracks: (payload.streams ?? []).map((track, audioIndex) => ({ audioIndex, language: track.tags?.language || "und", title: track.tags?.title || null, codec: track.codec_name?.toUpperCase() || "Unknown", channels: track.channels ?? null })) });
  } catch {
    return Response.json({ tracks: [] });
  }
}
