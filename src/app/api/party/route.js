import {
  createWatchParty,
  getWatchParty,
} from "@/lib/watchParty";

/** POST — create a watch party room. */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await createWatchParty({
      catalogId: body.catalogId,
      mediaType: body.mediaType,
      season: body.season,
      episode: body.episode,
      hostNickname: body.nickname,
      title: body.title,
    });
    return Response.json(result);
  } catch (err) {
    console.error("[party/create]", err);
    return Response.json(
      { error: err?.message || "Failed to create party" },
      { status: 400 }
    );
  }
}

/** GET ?roomId= — fetch room state (polling). */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");
    const memberId = searchParams.get("memberId");

    if (!roomId) {
      return Response.json({ error: "roomId required" }, { status: 400 });
    }

    let room = await getWatchParty(roomId);
    if (!room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    if (memberId) {
      const { heartbeatWatchParty } = await import("@/lib/watchParty");
      const beat = await heartbeatWatchParty(roomId, memberId);
      if (beat) room = beat;
    }

    return Response.json({ room });
  } catch (err) {
    console.error("[party/get]", err);
    return Response.json({ error: "Failed to load party" }, { status: 500 });
  }
}
