import {
  getWatchParty,
  updateWatchPartyState,
  updateWatchPartySettings,
  releasePartySyncCheckpoint,
} from "@/lib/watchParty";

/** PATCH — host updates episode, settings, or sync checkpoint. */
export async function PATCH(req, { params }) {
  try {
    const roomId = (await params).roomId;
    const body = await req.json().catch(() => ({}));
    const hostToken = req.headers.get("x-party-host-token") || body.hostToken;

    if (body.settings) {
      const room = await updateWatchPartySettings(roomId, hostToken, body.settings);
      return Response.json({ room });
    }

    if (body.releaseSyncHold) {
      const room = await releasePartySyncCheckpoint(roomId, hostToken, {
        playbackSeconds: body.playbackSeconds,
        season: body.season,
        episode: body.episode,
      });
      return Response.json({ room });
    }

    const room = await updateWatchPartyState(roomId, hostToken, {
      season: body.season,
      episode: body.episode,
      title: body.title,
      playbackSeconds: body.playbackSeconds,
    });
    return Response.json({ room });
  } catch (err) {
    const msg = err?.message || "Failed";
    const status = msg === "Unauthorized" ? 403 : 400;
    return Response.json({ error: msg }, { status });
  }
}

/** GET — room state */
export async function GET(_req, { params }) {
  try {
    const roomId = (await params).roomId;
    const room = await getWatchParty(roomId);
    if (!room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }
    return Response.json({ room });
  } catch (err) {
    console.error("[party/room GET]", err);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
