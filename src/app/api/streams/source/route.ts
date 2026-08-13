import {
  attachStreamEndpoints,
  clientIpFromRequest,
  resolveStremioStreams,
  stremioAddonCount,
  streamFetchErrorMessage,
} from "@/lib/stremio/client";
import { parseStreamsRequest } from "@/lib/stremio/parseStreamsRequest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function sseChunk(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request) {
  const parsed = parseStreamsRequest(request);
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.error, code: parsed.code },
      { status: parsed.status }
    );
  }

  const { type, resourceId, addonIndex, caps } = parsed;
  const clientIp = clientIpFromRequest(request);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (event: string, data: unknown) => {
        controller.enqueue(sseChunk(event, data));
      };

      try {
        const result = await resolveStremioStreams(
          type,
          resourceId,
          addonIndex,
          caps,
          clientIp
        );
        const streams = attachStreamEndpoints(result.streams, {
          type,
          resourceId,
          addonIndex,
          caps,
        });

        if (streams.length === 0) {
          const message =
            streamFetchErrorMessage(
              { errors: result.errors, unsupported: result.unsupported },
              streams
            ) ?? "No streams found for this title.";
          push("error", { message });
        } else {
          for (let index = 0; index < streams.length; index += 1) {
            push("stream", { index, stream: streams[index] });
          }
        }

        push("meta", {
          addonIndex,
          hasMoreAddons: addonIndex + 1 < stremioAddonCount(),
          unsupported: result.unsupported,
          errors: result.errors,
        });
      } catch (error) {
        console.error("GET /api/streams/source", error);
        push("error", { message: "The configured stream addon could not be reached." });
      } finally {
        push("done", {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
