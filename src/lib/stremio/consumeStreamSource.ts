import type { PlayableStream } from "@/lib/stremio/types";
import type { StreamSourceMeta } from "@/lib/stremio/client";

type StreamSourceHandlers = {
  onStream: (index: number, stream: PlayableStream) => void;
  onMeta: (meta: StreamSourceMeta) => void;
  onError: (message: string) => void;
  onDone: () => void;
};

function dispatchSseChunk(chunk: string, handlers: StreamSourceHandlers) {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of chunk.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return;
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
  } catch {
    return;
  }

  if (event === "stream") {
    const index = Number(payload.index);
    const stream = payload.stream;
    if (Number.isInteger(index) && index >= 0 && stream && typeof stream === "object") {
      handlers.onStream(index, stream as PlayableStream);
    }
    return;
  }
  if (event === "meta") {
    handlers.onMeta({
      addonIndex: Number(payload.addonIndex) || 0,
      hasMoreAddons: Boolean(payload.hasMoreAddons),
      unsupported: Number(payload.unsupported) || 0,
      errors: Array.isArray(payload.errors)
        ? (payload.errors as { addon: string; message: string }[])
        : [],
    });
    return;
  }
  if (event === "error") {
    handlers.onError(
      typeof payload.message === "string" ? payload.message : "Could not load streams"
    );
    return;
  }
  if (event === "done") handlers.onDone();
}

/** Read an SSE stream from /api/streams/source and invoke handlers per event. */
export async function consumeStreamSource(
  url: string,
  signal: AbortSignal,
  handlers: StreamSourceHandlers
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal,
      headers: { Accept: "text/event-stream" },
    });
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === "AbortError") return;
    handlers.onError(reason instanceof Error ? reason.message : "Could not load streams");
    handlers.onDone();
    return;
  }

  if (!response.ok) {
    let message = "Could not load streams";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    handlers.onError(message);
    handlers.onDone();
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    handlers.onError("The stream service returned an empty response.");
    handlers.onDone();
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        if (part.trim()) dispatchSseChunk(part, handlers);
      }
    }
    if (buffer.trim()) dispatchSseChunk(buffer, handlers);
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === "AbortError") return;
    handlers.onError(reason instanceof Error ? reason.message : "Could not load streams");
  } finally {
    handlers.onDone();
  }
}
