import { joinWatchParty } from "@/lib/watchParty";

export async function POST(req, { params }) {
  try {
    const roomId = (await params).roomId;
    const body = await req.json().catch(() => ({}));
    const result = await joinWatchParty(roomId, {
      nickname: body.nickname,
      memberId: body.memberId,
    });
    return Response.json(result);
  } catch (err) {
    console.error("[party/join]", err);
    return Response.json(
      { error: err?.message || "Failed to join" },
      { status: 400 }
    );
  }
}
