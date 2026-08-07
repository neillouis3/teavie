import { spawn } from "node:child_process";
import { Readable } from "node:stream";

import { resolveStremioStreams } from "@/lib/stremio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  const resourceId = params.get("id")?.trim() ?? "";
  const index = Number(params.get("index") ?? "0");
  const audio = Number(params.get("audio") ?? "0");
  const fallback = params.get("fallback") === "1";
  const preferSafari = params.get("safari") === "1";

  if (type !== "movie" && type !== "series") {
    return Response.json({ error: "Invalid media type" }, { status: 400 });
  }
  if (!/^tt\d+(?::\d+:\d+)?$/i.test(resourceId) || !Number.isInteger(index) || index < 0 || !Number.isInteger(audio) || audio < 0) {
    return Response.json({ error: "Invalid stream request" }, { status: 400 });
  }

  const result = await resolveStremioStreams(type, resourceId, fallback ? 1 : 0, preferSafari);
  const stream = result.streams[index];
  if (!stream) {
    return Response.json({ error: "Stream is no longer available" }, { status: 404 });
  }

  const ffmpeg = spawn(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-fflags",
      "+genpts+discardcorrupt",
      "-user_agent",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
      "-headers",
      "Accept: */*\r\nAccept-Language: en-US,en;q=0.9\r\n",
      "-reconnect",
      "1",
      "-reconnect_streamed",
      "1",
      "-reconnect_delay_max",
      "5",
      "-rw_timeout",
      "20000000",
      "-http_persistent",
      "0",
      "-i",
      stream.url,
      "-map",
      "0:v:0",
      "-map",
      `0:a:${audio}?`,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-tune",
      "zerolatency",
      "-pix_fmt",
      "yuv420p",
      "-vf",
      "scale=min(1920\\,iw):-2",
      "-g",
      "48",
      "-c:a",
      "aac",
      "-ac",
      "2",
      "-b:a",
      "192k",
      "-avoid_negative_ts",
      "make_zero",
      "-movflags",
      "+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset",
      "-f",
      "mp4",
      "pipe:1",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  request.signal.addEventListener("abort", () => ffmpeg.kill("SIGTERM"), { once: true });
  ffmpeg.stderr.on("data", (chunk) => {
    const message = String(chunk).trim();
    if (message && !/broken pipe/i.test(message)) console.error("Safari remux:", message);
  });

  return new Response(Readable.toWeb(ffmpeg.stdout) as ReadableStream, {
    headers: {
      "Content-Type": "video/mp4",
      "Cache-Control": "no-store",
      "Accept-Ranges": "none",
    },
  });
}
