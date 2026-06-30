import { postWatchPartyMessage } from "@/lib/watchParty";

export async function POST(req, { params }) {
  try {
    const roomId = (await params).roomId;
    const body = await req.json().catch(() => ({}));
    const msg = await postWatchPartyMessage(roomId, body.memberId, body.text);
    return Response.json({ message: msg });
  } catch (err) {
    console.error("[party/chat]", err);
    return Response.json(
      { error: err?.message || "Failed to send" },
      { status: 400 }
    );
  }
}
