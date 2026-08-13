import { resolveStreamPlaybackUrl } from "@/lib/stremio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  if (!raw) {
    return Response.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return Response.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return Response.json({ error: "Invalid url protocol" }, { status: 400 });
  }

  const resolved = await resolveStreamPlaybackUrl(raw);
  return Response.json(
    { url: resolved },
    { headers: { "Cache-Control": "private, max-age=300" } }
  );
}
